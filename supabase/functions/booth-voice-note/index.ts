// booth-voice-note
//
// Lotexpo Leads : note vocale enregistrée sur le stand (90 secondes au plus).
// Appel depuis le site avec la session de l'utilisateur (verify_jwt = true).
//
// 1. booth_voice_authorize, AVEC la session de l'appelant : appartenance à l'équipe, formule
//    (pas de vocal en formule gratuite), salon non archivé, durée, plafonds sur 24 h et sur le mois,
//    idempotence (une note renvoyée n'est ni recomptée ni retraitée).
// 2. Transcription (_shared/transcription.ts, prestataire unique du projet). L'audio reste en mémoire :
//    jamais stocké, jamais journalisé.
// 3. Mode « capture » : Claude propose les champs de la rencontre à partir de la transcription
//    (personne, entreprise, relation, potentiel, projet, action, échéance, note). Normalisation stricte :
//    un champ douteux devient vide, jamais inventé. L'utilisateur valide toujours avant d'enregistrer.
//    Mode « note » : transcription seule, pour la note de la rencontre.
// 4. Journal du résultat avec la clé serveur (_booth_voice_complete). Transcription et champs effacés
//    au bout de 30 jours.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { ANTHROPIC_API_URL, buildAnthropicHeaders, getAnthropicModelFast } from '../_shared/anthropic.ts';
import { transcribe } from '../_shared/transcription.ts';

const LOG = '[booth-voice-note]';
const MAX_BASE64 = 3_000_000;          // environ 2,2 Mo d'audio, largement assez pour 90 s
const TRANSCRIBE_TIMEOUT_MS = 40_000;
const MODEL_TIMEOUT_MS = 25_000;
const DEFAULT_ANALYSIS_MODEL = 'claude-haiku-4-5-20251001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AUDIO_EXT: Record<string, string> = {
  'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a', 'audio/aac': 'm4a',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
};

const RELATIONSHIPS = ['new_prospect', 'customer', 'partner', 'other'] as const;
const TOPICS = ['new_project', 'existing_business', 'relationship'] as const;
const POTENTIALS = ['hot', 'good', 'explore', 'none'] as const;
const ACTIONS = ['call', 'send_doc', 'quote', 'meeting', 'email', 'other', 'none'] as const;
const BANDS = ['lt5k', '5_20k', '20_50k', '50_100k', 'gt100k'] as const;
const HORIZONS = ['lt3m', '3_6m', '6_12m', 'gt12m'] as const;
const CONTACT_FIELDS = ['first_name', 'last_name', 'company_name', 'job_title', 'email', 'phone'] as const;
type ContactField = typeof CONTACT_FIELDS[number];
const MAXLEN: Record<ContactField, number> = {
  first_name: 80, last_name: 80, company_name: 160, job_title: 160, email: 200, phone: 40,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const ERROR_STATUS: Record<string, number> = {
  BOOTH_AUTH_REQUIRED: 401,
  BOOTH_FORBIDDEN: 403,
  BOOTH_NOT_FOUND: 404,
  BOOTH_PLAN_REQUIRED: 402,
  BOOTH_WORKSPACE_ARCHIVED: 409,
  BOOTH_AUDIO_TOO_LONG: 413,
  BOOTH_VOICE_QUOTA: 429,
  BOOTH_RATE_LIMITED: 429,
  BOOTH_INVALID_INPUT: 400,
  BOOTH_DISABLED: 503,
};

interface Ctx { today_local: string; salon_name: string | null; salon_start: string | null; salon_end: string | null }

function systemPrompt(ctx: Ctx): string {
  return `Tu reçois la transcription d'une note vocale dictée par un commercial sur le stand de son entreprise, juste après une rencontre sur un salon professionnel.
Salon : ${ctx.salon_name ?? 'inconnu'}, du ${ctx.salon_start ?? '?'} au ${ctx.salon_end ?? '?'}. Date du jour : ${ctx.today_local}.

Tu renvoies UNIQUEMENT un objet JSON, sans texte autour, de la forme :
{"contact": {"first_name": "", "last_name": "", "company_name": "", "job_title": "", "email": "", "phone": ""},
 "relationship": "", "customer_topic": "", "potential": "",
 "project": {"has_project": false, "title": "", "value_band": "", "amount": null, "horizon": ""},
 "next_action": "", "next_action_due": "", "note": "",
 "confidence": {"company_name": "high", ...}}

Règles absolues :
- N'utilise que ce qui est dit. N'invente rien, ne complète rien. Une information non dite vaut "" (ou null, ou false).
- contact : la personne rencontrée (jamais le commercial qui parle). Une adresse email dictée (« jean point dupont arobase airbus point com ») s'écrit normalement (jean.dupont@airbus.com). Un numéro dicté s'écrit en chiffres.
- relationship : "new_prospect" (nouveau contact, prospect), "customer" (client existant), "partner" (partenaire, fournisseur, distributeur), "other" (concurrent, presse, étudiant, autre). Vide si rien ne permet de le dire.
- customer_topic, seulement si relationship = "customer" : "new_project", "existing_business" (suivi d'une affaire en cours), "relationship" (visite de courtoisie).
- potential, seulement si relationship n'est pas "customer" : "hot" (projet clair, urgent ou budgété), "good" (intérêt réel), "explore" (à creuser), "none" (pas de potentiel). Vide si rien ne permet de le dire.
- project.has_project : true seulement si un projet concret est mentionné. title : 3 à 8 mots. amount : montant en euros s'il est dit (nombre). value_band : "lt5k", "5_20k", "20_50k", "50_100k", "gt100k" si un ordre de grandeur est dit. horizon : "lt3m", "3_6m", "6_12m", "gt12m" si un délai est dit.
- next_action : "call" (rappeler), "send_doc" (envoyer une documentation), "quote" (devis), "meeting" (rendez-vous), "email", "other", "none" (rien à faire). Vide si rien n'est dit.
- next_action_due : date AAAA-MM-JJ calculée à partir de la date du jour si une échéance est dite (« demain », « lundi », « dans deux semaines »). « Après le salon » = le lendemain du dernier jour du salon. Vide sinon.
- note : résumé factuel en français, 600 caractères au plus, des informations utiles qui ne rentrent pas dans les autres champs (besoin, contexte, objections, prochaines étapes). Pas d'email ni de téléphone dans la note. Vide si rien d'autre n'est dit.
- confidence : pour chaque champ rempli de contact, "high", "medium" ou "low" (orthographe d'un nom incertaine = "low").`;
}

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}

function oneOf<T extends readonly string[]>(v: unknown, list: T): T[number] | null {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T[number] : null;
}

function bandFromAmount(a: number): typeof BANDS[number] {
  if (a < 5000) return 'lt5k';
  if (a < 20000) return '5_20k';
  if (a < 50000) return '20_50k';
  if (a < 100000) return '50_100k';
  return 'gt100k';
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalize(raw: Record<string, unknown>, ctx: Ctx) {
  const c = (raw.contact && typeof raw.contact === 'object') ? raw.contact as Record<string, unknown> : {};
  const contact: Record<ContactField, string | null> = {} as Record<ContactField, string | null>;
  for (const f of CONTACT_FIELDS) contact[f] = clean(c[f], MAXLEN[f]);
  if (contact.email) {
    const e = contact.email.replace(/\s/g, '').replace(/^mailto:/i, '').toLowerCase();
    contact.email = EMAIL_RE.test(e) ? e : null;
  }
  if (contact.phone && (contact.phone.replace(/\D/g, '').length < 6 || /[a-z]{3,}/i.test(contact.phone))) contact.phone = null;

  const relationship = oneOf(raw.relationship, RELATIONSHIPS);
  const customer_topic = relationship === 'customer' ? oneOf(raw.customer_topic, TOPICS) : null;
  const potential = relationship === 'customer' ? null : oneOf(raw.potential, POTENTIALS);

  const p = (raw.project && typeof raw.project === 'object') ? raw.project as Record<string, unknown> : {};
  let project: Record<string, unknown> | null = null;
  if (p.has_project === true) {
    const amountRaw = typeof p.amount === 'number' ? p.amount : Number(p.amount);
    const amount = Number.isFinite(amountRaw) && amountRaw > 0 && amountRaw < 1e9 ? Math.round(amountRaw) : null;
    project = {
      title: clean(p.title, 300),
      amount,
      value_band: oneOf(p.value_band, BANDS) ?? (amount != null ? bandFromAmount(amount) : null),
      horizon: oneOf(p.horizon, HORIZONS),
    };
  }

  const next_action = oneOf(raw.next_action, ACTIONS);
  let next_action_due: string | null = null;
  if (next_action && next_action !== 'none' && typeof raw.next_action_due === 'string' && DATE_RE.test(raw.next_action_due)) {
    const d = raw.next_action_due;
    // Échéance plausible : d'hier à un an et demi
    if (d >= addDays(ctx.today_local, -1) && d <= addDays(ctx.today_local, 550)) next_action_due = d;
  }

  const note = clean(raw.note, 1200);

  const confIn = (raw.confidence && typeof raw.confidence === 'object') ? raw.confidence as Record<string, unknown> : {};
  const confidence: Partial<Record<ContactField, 'high' | 'medium' | 'low'>> = {};
  for (const f of CONTACT_FIELDS) {
    if (!contact[f]) continue;
    const v = confIn[f];
    confidence[f] = v === 'high' || v === 'medium' ? v : 'low';
  }

  return {
    fields: { contact, relationship, customer_topic, potential, project, next_action, next_action_due, note },
    confidence,
  };
}

function parseModelJson(text: string): Record<string, unknown> | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(t.slice(start, end + 1));
    return o && typeof o === 'object' ? o as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function callModel(apiKey: string, model: string, system: string, transcript: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MODEL_TIMEOUT_MS);
  try {
    return await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: buildAnthropicHeaders(apiKey),
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: `Transcription de la note vocale :\n"""\n${transcript}\n"""\nRenvoie le JSON.` }],
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'BOOTH_AUTH_REQUIRED' }, 401);

  let body: { workspace_id?: string; note_id?: string; mode?: string; audio_base64?: string; media_type?: string; duration_ms?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }
  const workspaceId = body.workspace_id ?? '';
  const noteId = body.note_id ?? '';
  const mode = body.mode === 'note' ? 'note' : 'capture';
  const mediaType = (body.media_type ?? '').toLowerCase().split(';')[0].trim();
  const ext = AUDIO_EXT[mediaType];
  const durationMs = Math.round(Number(body.duration_ms));
  const audioB64 = (body.audio_base64 ?? '').replace(/^data:[^,]+,/, '');
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(noteId) || !ext || !audioB64 || !Number.isFinite(durationMs) || durationMs < 0) {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }
  if (audioB64.length > MAX_BASE64) return json({ error: 'BOOTH_AUDIO_TOO_LARGE' }, 413);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });

  // 1. Contrôles par la base, avec l'identité réelle de l'appelant
  const { data: auth, error: authErr } = await userClient.rpc('booth_voice_authorize', {
    p_workspace_id: workspaceId,
    p_note_id: noteId,
    p_duration_ms: durationMs,
    p_mode: mode,
  });
  if (authErr) {
    const code = Object.keys(ERROR_STATUS).find((k) => authErr.message?.includes(k))
      ?? (/permission denied/i.test(authErr.message ?? '') ? 'BOOTH_AUTH_REQUIRED' : 'BOOTH_ERROR');
    return json({ error: code }, ERROR_STATUS[code] ?? 500);
  }
  if (auth?.already_done) {
    if (auth.status === 'empty') return json({ note_id: noteId, status: 'empty' });
    return json({ note_id: noteId, status: 'ok', transcript: auth.transcript ?? '', ...(auth.extracted ?? {}) });
  }
  const ctx: Ctx = auth?.context ?? { today_local: new Date().toISOString().slice(0, 10), salon_name: null, salon_start: null, salon_end: null };

  let audioBytes = 0;
  let transcribeModel: string | null = null;
  let analysisModel: string | null = null;
  let transcribeMs: number | null = null;
  const t0 = Date.now();
  const finish = async (status: 'ok' | 'empty' | 'error', transcript: string | null, extracted: unknown,
                        inTok: number | null, outTok: number | null, errorCode: string | null) => {
    const { error } = await serviceClient.rpc('_booth_voice_complete', {
      p_note_id: noteId, p_status: status, p_transcript: transcript, p_extracted: extracted,
      p_transcribe_model: transcribeModel, p_analysis_model: analysisModel,
      p_transcribe_ms: transcribeMs, p_latency_ms: Date.now() - t0,
      p_input_tokens: inTok, p_output_tokens: outTok, p_audio_bytes: audioBytes, p_error_code: errorCode,
    });
    if (error) console.error(`${LOG} journal impossible (${error.code ?? 'inconnu'})`);
  };

  // 2. Transcription (audio en mémoire seulement)
  let audio: Uint8Array<ArrayBuffer>;
  try {
    const bin = atob(audioB64);
    audio = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) audio[i] = bin.charCodeAt(i);
  } catch {
    await finish('error', null, null, null, null, 'bad_base64');
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }
  audioBytes = audio.length;

  let transcript = '';
  try {
    const tr0 = Date.now();
    const r = await withTimeout(transcribe({
      audio: new Blob([audio], { type: mediaType }),
      filename: `note.${ext}`,
      language: 'fr',
      prompt: `Note d'un commercial après une rencontre sur le salon ${ctx.salon_name ?? 'professionnel'} : nom de la personne, entreprise, fonction, email, téléphone, projet, prochaine action.`,
    }), TRANSCRIBE_TIMEOUT_MS);
    transcribeMs = Date.now() - tr0;
    transcribeModel = `${r.provider}:${r.model}`;
    transcript = r.text.replace(/\s+/g, ' ').trim();
  } catch (e) {
    const code = (e && typeof e === 'object' && 'code' in e) ? String((e as { code: string }).code) : 'transcription_failed';
    console.error(`${LOG} transcription ${code}`);
    await finish('error', null, null, null, null, `tr_${code}`);
    return json({ error: 'BOOTH_VOICE_FAILED' }, 502);
  }

  if (transcript.replace(/[^\p{L}\p{N}]/gu, '').length < 3) {
    await finish('empty', null, null, null, null, null);
    return json({ note_id: noteId, status: 'empty' });
  }

  // 3a. Mode note : transcription seule
  if (mode === 'note') {
    await finish('ok', transcript, null, null, null, null);
    return json({ note_id: noteId, status: 'ok', transcript, remaining_month: auth?.remaining_month ?? null });
  }

  // 3b. Mode capture : champs proposés par Claude
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!apiKey) {
    // La transcription reste utile : on la renvoie sans champs
    await finish('ok', transcript, null, null, null, 'no_api_key');
    return json({ note_id: noteId, status: 'ok', transcript, fields: null, remaining_month: auth?.remaining_month ?? null });
  }
  analysisModel = Deno.env.get('BOOTH_VOICE_MODEL') || DEFAULT_ANALYSIS_MODEL;
  const system = systemPrompt(ctx);
  let res: Response;
  try {
    res = await callModel(apiKey, analysisModel, system, transcript);
    if (res.status === 404 || res.status === 400) {
      // Modèle indisponible : repli sur le modèle rapide commun du projet
      analysisModel = getAnthropicModelFast();
      res = await callModel(apiKey, analysisModel, system, transcript);
    }
  } catch (e) {
    const code = (e as Error)?.name === 'AbortError' ? 'timeout' : 'network_error';
    await finish('ok', transcript, null, null, null, `an_${code}`);
    return json({ note_id: noteId, status: 'ok', transcript, fields: null, remaining_month: auth?.remaining_month ?? null });
  }
  if (!res.ok) {
    console.error(`${LOG} modèle ${res.status}`);
    await finish('ok', transcript, null, null, null, `an_http_${res.status}`);
    return json({ note_id: noteId, status: 'ok', transcript, fields: null, remaining_month: auth?.remaining_month ?? null });
  }

  const payload = await res.json().catch(() => null) as
    { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } } | null;
  const inTok = payload?.usage?.input_tokens ?? null;
  const outTok = payload?.usage?.output_tokens ?? null;
  const raw = parseModelJson((payload?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''));
  if (!raw) {
    await finish('ok', transcript, null, inTok, outTok, 'an_bad_json');
    return json({ note_id: noteId, status: 'ok', transcript, fields: null, remaining_month: auth?.remaining_month ?? null });
  }

  // 4. Normalisation et journal
  const result = normalize(raw, ctx);
  await finish('ok', transcript, result, inTok, outTok, null);
  return json({ note_id: noteId, status: 'ok', transcript, ...result, remaining_month: auth?.remaining_month ?? null });
});
