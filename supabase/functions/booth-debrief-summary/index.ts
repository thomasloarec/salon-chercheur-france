// booth-debrief-summary
//
// Lotexpo Leads : synthèse IA du débrief (une journée du salon ou tout le salon).
// Appel depuis le site avec la session de l'utilisateur (verify_jwt = true).
//
// 1. booth_debrief_authorize, AVEC la session de l'appelant : appartenance à l'équipe, formule
//    (pas de synthèse IA en formule gratuite), plafond sur 24 h. La base renvoie les rencontres du
//    périmètre sous forme compacte, sans email ni téléphone.
// 2. Claude rédige une synthèse structurée en français, fondée uniquement sur ces rencontres.
//    Aucune relance n'est rédigée (décision du 05/10/2026 : les relances sont faites par les commerciaux).
// 3. La synthèse n'est pas stockée : seul un journal technique est écrit (_booth_debrief_complete).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { ANTHROPIC_API_URL, buildAnthropicHeaders, getAnthropicModelFast } from '../_shared/anthropic.ts';

const LOG = '[booth-debrief-summary]';
const MODEL_TIMEOUT_MS = 40_000;
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  BOOTH_RATE_LIMITED: 429,
  BOOTH_INVALID_INPUT: 400,
  BOOTH_DISABLED: 503,
};

const SYSTEM_PROMPT = `Tu aides l'équipe commerciale d'un exposant à faire le débrief d'une journée de salon professionnel.
Tu reçois la liste des rencontres enregistrées (heure, entreprise, personne, fonction, relation, potentiel, action prévue, échéance, responsable, note, projet).
Valeurs utilisées : relationship = new_prospect (nouveau prospect), customer (client), partner (partenaire), other (autre) ;
potential = hot (chaud), good (bon), explore (à explorer), none (aucun) ; next_action = call (rappeler), send_doc (envoyer une documentation),
quote (devis), meeting (rendez-vous), email, other (autre).

Tu renvoies UNIQUEMENT un objet JSON, sans texte autour :
{"headline": "", "overview": "", "priorities": [{"company": "", "person": "", "reason": "", "action": ""}],
 "followups": [{"company": "", "action": "", "due": "", "followed_by": ""}], "signals": [""]}

Règles absolues :
- Français, ton professionnel et direct, phrases courtes. Aucun tiret long.
- N'utilise que les rencontres fournies. N'invente aucun nom, chiffre, besoin ou engagement.
- headline : une phrase qui résume la journée (volume, qualité).
- overview : 2 à 4 phrases (chiffres clés, types de visiteurs, ce qui ressort).
- priorities : au plus 5 rencontres à traiter en premier (potentiel chaud, projet chiffré, échéance proche), avec la raison en une phrase et l'action prévue en clair.
- followups : au plus 10 actions non faites, triées par échéance (due au format JJ/MM, vide si aucune), avec le responsable.
- signals : au plus 4 constats utiles (besoin qui revient, secteur dominant, objection fréquente, rencontres sans action prévue). Liste vide si rien de solide.
- Ne rédige aucun email ni message de relance.
- Ne recopie jamais d'adresse email ni de numéro de téléphone.`;

function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, ' ').replace(/—/g, ',').trim().slice(0, max);
}

function stripContacts(s: string): string {
  return s.replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '[email]').replace(/\+?\d[\d .]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[téléphone]' : m));
}

function normalize(raw: Record<string, unknown>) {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Array<Record<string, unknown>>;
  const t = (v: unknown, n: number) => stripContacts(clean(v, n));
  return {
    headline: t(raw.headline, 200),
    overview: t(raw.overview, 800),
    priorities: arr(raw.priorities).slice(0, 5).map((p) => ({
      company: t(p.company, 160), person: t(p.person, 160), reason: t(p.reason, 300), action: t(p.action, 200),
    })).filter((p) => p.company || p.person),
    followups: arr(raw.followups).slice(0, 10).map((f) => ({
      company: t(f.company, 160), action: t(f.action, 200), due: t(f.due, 10), followed_by: t(f.followed_by, 120),
    })).filter((f) => f.company || f.action),
    signals: (Array.isArray(raw.signals) ? raw.signals : []).slice(0, 4).map((s) => t(s, 300)).filter(Boolean),
  };
}

function parseModelJson(text: string): Record<string, unknown> | null {
  const s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(s.slice(a, b + 1));
    return o && typeof o === 'object' ? o as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function callModel(apiKey: string, model: string, userText: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MODEL_TIMEOUT_MS);
  try {
    return await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: buildAnthropicHeaders(apiKey),
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userText }],
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

  let body: { workspace_id?: string; day?: string | null; scope?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }
  const workspaceId = body.workspace_id ?? '';
  const day = body.day ?? null;
  const scope = body.scope === 'mine' ? 'mine' : 'team';
  if (!UUID_RE.test(workspaceId) || (day !== null && !DATE_RE.test(day))) {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });

  // 1. Contrôles et données, avec l'identité réelle de l'appelant
  const { data, error: authErr } = await userClient.rpc('booth_debrief_authorize', {
    p_workspace_id: workspaceId,
    p_day: day,
    p_scope: scope,
  });
  if (authErr) {
    const code = Object.keys(ERROR_STATUS).find((k) => authErr.message?.includes(k))
      ?? (/permission denied/i.test(authErr.message ?? '') ? 'BOOTH_AUTH_REQUIRED' : 'BOOTH_ERROR');
    return json({ error: code }, ERROR_STATUS[code] ?? 500);
  }
  const summaryId: string = data?.summary_id;
  const total: number = data?.total ?? 0;
  if (total === 0) return json({ summary_id: summaryId, status: 'empty', total: 0 });

  const t0 = Date.now();
  let model = Deno.env.get('BOOTH_DEBRIEF_MODEL') || DEFAULT_MODEL;
  const finish = async (status: 'ok' | 'error', inTok: number | null, outTok: number | null, errorCode: string | null) => {
    const { error } = await serviceClient.rpc('_booth_debrief_complete', {
      p_summary_id: summaryId, p_status: status, p_model: model, p_latency_ms: Date.now() - t0,
      p_input_tokens: inTok, p_output_tokens: outTok, p_error_code: errorCode,
    });
    if (error) console.error(`${LOG} journal impossible (${error.code ?? 'inconnu'})`);
  };

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!apiKey) {
    await finish('error', null, null, 'no_api_key');
    return json({ error: 'BOOTH_SUMMARY_FAILED' }, 502);
  }

  const salon = data?.salon ?? {};
  const userText = `Salon : ${salon.name ?? 'inconnu'} (du ${salon.start ?? '?'} au ${salon.end ?? '?'}). `
    + `Périmètre : ${day ? `journée du ${day}` : 'tout le salon'}, ${scope === 'mine' ? 'rencontres de la personne qui demande' : "rencontres de toute l'équipe"}. `
    + `${total} rencontres${data?.truncated ? ' (les 300 premières seulement sont listées)' : ''}.\n`
    + `Rencontres (JSON) :\n${JSON.stringify(data?.items ?? [])}\nRenvoie le JSON de synthèse.`;

  let res: Response;
  try {
    res = await callModel(apiKey, model, userText);
    if (res.status === 404 || res.status === 400) {
      model = getAnthropicModelFast();
      res = await callModel(apiKey, model, userText);
    }
  } catch (e) {
    const code = (e as Error)?.name === 'AbortError' ? 'timeout' : 'network_error';
    await finish('error', null, null, code);
    return json({ error: 'BOOTH_SUMMARY_FAILED' }, 502);
  }
  if (!res.ok) {
    console.error(`${LOG} modèle ${res.status}`);
    await finish('error', null, null, `http_${res.status}`);
    return json({ error: 'BOOTH_SUMMARY_FAILED' }, 502);
  }

  const payload = await res.json().catch(() => null) as
    { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } } | null;
  const inTok = payload?.usage?.input_tokens ?? null;
  const outTok = payload?.usage?.output_tokens ?? null;
  const raw = parseModelJson((payload?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''));
  if (!raw) {
    await finish('error', inTok, outTok, 'bad_json');
    return json({ error: 'BOOTH_SUMMARY_FAILED' }, 502);
  }

  const summary = normalize(raw);
  await finish('ok', inTok, outTok, null);
  return json({ summary_id: summaryId, status: 'ok', total, truncated: !!data?.truncated, day, scope, summary });
});
