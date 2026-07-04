// Radar CRM · Mode Mission · Traitement IA d'une note vocale.
// Réponse 202 immédiate + traitement en tâche de fond (EdgeRuntime.waitUntil, 400 s Pro).
// Transcription: OpenAI (via _shared/transcription.ts). Analyse: Claude.
// Ne crée PAS la note/tâches finales (validation utilisateur via RPC dédiée).
// L'audio n'est JAMAIS supprimé ici (retry / refaire l'analyse possibles).

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod';
import { transcribe } from '../_shared/transcription.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANALYSIS_MODEL = Deno.env.get('RADAR_VOICE_ANALYSIS_MODEL') ?? 'claude-haiku-4-5-20251001';
const BUCKET = 'radar-voice-notes';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// mime → extension (miroir du contrat de capture front)
function mimeToExt(mime: string): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  switch (base) {
    case 'audio/webm': return 'webm';
    case 'audio/mp4':  return 'm4a';
    case 'audio/mpeg': return 'mp3';
    case 'audio/wav':  return 'wav';
    default:           return 'webm';
  }
}

// ---- schéma de sortie de l'analyse (contrat EF ↔ front) ----
const ConfidenceEnum = z.enum(['high', 'medium', 'low']);
const PayloadSchema = z.object({
  summary_note: z.string().min(1),
  key_points: z.array(z.string()).default([]),
  detected_people: z.array(z.object({
    name: z.string().min(1),
    role: z.string().nullish(),
    confidence: ConfidenceEnum.optional(),
  })).default([]),
  detected_tasks: z.array(z.object({
    body: z.string().min(1),
    due_at: z.string().nullish(),
    confidence: ConfidenceEnum.optional(),
  })).default([]),
  follow_up_suggestion: z.string().nullish(),
  crm_relevance: z.string().nullish(),
  needs_review: z.boolean().default(false),
});
type Payload = z.infer<typeof PayloadSchema>;

class AnalysisError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; this.name = 'AnalysisError'; }
}

// ---- contexte mission (best-effort, null-safe : n'échoue JAMAIS le pipeline) ----
interface MissionContext {
  companyName: string | null;
  companyWebsite: string | null;
  eventName: string | null;
  objective: string | null;
  topQuestions: string[];
  offer: { sells: string | null; target: string | null; problem: string | null; qualifies: string | null } | null;
}

async function fetchContext(supabase: SupabaseClient, vn: Record<string, unknown>): Promise<MissionContext> {
  const ctx: MissionContext = {
    companyName: null, companyWebsite: null, eventName: null,
    objective: null, topQuestions: [], offer: null,
  };
  try {
    const { data: mission } = await supabase
      .from('radar_missions')
      .select('crm_company_id, objective, top_q1, top_q2, top_q3, event_id')
      .eq('id', vn.mission_id as string)
      .maybeSingle();

    if (mission) {
      ctx.objective = mission.objective ?? null;
      ctx.topQuestions = [mission.top_q1, mission.top_q2, mission.top_q3].filter(Boolean) as string[];

      if (mission.crm_company_id) {
        // select * : les noms de colonnes de crm_companies ne sont pas garantis → extraction défensive
        const { data: c } = await supabase.from('crm_companies').select('*').eq('id', mission.crm_company_id).maybeSingle();
        if (c) {
          ctx.companyName = c.company_name ?? c.name ?? c.nom ?? null;
          ctx.companyWebsite = c.website ?? c.normalized_domain ?? c.domain ?? null;
        }
      }
      const eid = mission.event_id ?? (vn.event_id as string | undefined);
      if (eid) {
        const { data: e } = await supabase.from('events').select('*').eq('id', eid).maybeSingle();
        if (e) ctx.eventName = e.nom_event ?? e.name ?? null;
      }
    }

    const { data: offer } = await supabase
      .from('radar_offer_profile')
      .select('sells, target, problem, qualifies')
      .eq('radar_account_id', vn.radar_account_id as string)
      .maybeSingle();
    if (offer) ctx.offer = offer;
  } catch (_e) {
    // contexte = assaisonnement de prompt : on n'échoue jamais ici
  }
  return ctx;
}

function buildTranscriptionPrompt(ctx: MissionContext): string {
  const bits: string[] = ["Mémo vocal d'un commercial après un échange sur un stand de salon professionnel en France."];
  if (ctx.companyName) bits.push(`Entreprise évoquée : ${ctx.companyName}.`);
  if (ctx.eventName) bits.push(`Salon : ${ctx.eventName}.`);
  const vocab = [ctx.offer?.sells, ctx.offer?.target].filter(Boolean).join(', ');
  if (vocab) bits.push(`Vocabulaire métier : ${vocab}.`);
  return bits.join(' ').slice(0, 900);
}

// ---- analyse Claude ----
const ANALYSIS_SYSTEM = [
  "Tu transformes un mémo vocal de commercial, pris juste après un échange sur un stand de salon professionnel, en note CRM structurée en français.",
  "Tu réponds UNIQUEMENT avec un objet JSON valide conforme au schéma demandé, sans texte avant ou après, sans balises Markdown.",
  "Règles impératives :",
  "- Ne détecte que les tâches explicitement énoncées ou très fortement implicites. En cas de doute, ne crée pas la tâche.",
  "- N'invente jamais une personne, une date, une entreprise ou une action qui n'a pas été prononcée.",
  "- Chaque tâche et chaque personne porte un niveau de confiance (high, medium, low).",
  "- due_at uniquement si une échéance est réellement mentionnée, au format ISO 8601 (sinon null).",
  "- Si l'audio est ambigu, inaudible ou trop pauvre pour une note fiable, mets needs_review à true.",
  "- La note (summary_note) est concise (4 à 6 lignes), factuelle, prête à être enregistrée telle quelle.",
].join('\n');

function buildAnalysisUserPrompt(transcript: string, ctx: MissionContext): string {
  const lines: string[] = [];
  if (ctx.companyName) lines.push(`Entreprise : ${ctx.companyName}`);
  if (ctx.companyWebsite) lines.push(`Site : ${ctx.companyWebsite}`);
  if (ctx.eventName) lines.push(`Salon : ${ctx.eventName}`);
  if (ctx.objective) lines.push(`Objectif de la visite : ${ctx.objective}`);
  if (ctx.topQuestions.length) lines.push(`Questions clés préparées : ${ctx.topQuestions.join(' | ')}`);
  if (ctx.offer) {
    const o = ctx.offer;
    const s = [
      o.sells && `vend : ${o.sells}`,
      o.target && `cible : ${o.target}`,
      o.problem && `problème résolu : ${o.problem}`,
      o.qualifies && `critères de qualification : ${o.qualifies}`,
    ].filter(Boolean).join(' ; ');
    if (s) lines.push(`Profil d'offre du commercial : ${s}`);
  }
  const contextBlock = lines.length ? `Contexte connu :\n${lines.join('\n')}\n\n` : '';

  const schema = `Schéma JSON attendu (respecte exactement les clés) :
{
  "summary_note": "string",
  "key_points": ["string"],
  "detected_people": [{ "name": "string", "role": "string|null", "confidence": "high|medium|low" }],
  "detected_tasks": [{ "body": "string", "due_at": "ISO8601|null", "confidence": "high|medium|low" }],
  "follow_up_suggestion": "string|null",
  "crm_relevance": "string|null",
  "needs_review": false
}`;

  return `${contextBlock}Transcription du mémo vocal :
"""
${transcript}
"""

${schema}`;
}

function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new AnalysisError('analysis_no_json', "Réponse d'analyse sans objet JSON.");
  }
  return raw.slice(start, end + 1);
}

async function analyzeTranscript(transcript: string, ctx: MissionContext): Promise<Payload> {
  if (!ANTHROPIC_API_KEY) {
    throw new AnalysisError('missing_api_key', 'ANTHROPIC_API_KEY absent des secrets Supabase.');
  }
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        max_tokens: 1500,
        temperature: 0,
        system: ANALYSIS_SYSTEM,
        messages: [
          { role: 'user', content: buildAnalysisUserPrompt(transcript, ctx) },
          { role: 'assistant', content: '{' }, // prefill : force une sortie JSON
        ],
      }),
    });
  } catch (e) {
    throw new AnalysisError('network', `Anthropic injoignable: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const code = res.status === 429 ? 'rate_limited' : res.status >= 500 ? 'provider_error' : 'bad_request';
    throw new AnalysisError(code, `Anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json().catch(() => ({}));
  const text = '{' + (data?.content?.[0]?.text ?? ''); // recoller le prefill
  const jsonStr = extractJsonObject(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (_e) {
    throw new AnalysisError('analysis_parse_failed', "JSON d'analyse invalide.");
  }

  const result = PayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new AnalysisError('analysis_schema_invalid', `Schéma non conforme: ${result.error.message.slice(0, 300)}`);
  }
  return result.data;
}

// ---- helpers statut ----
async function setStatus(supabase: SupabaseClient, id: string, status: string) {
  await supabase.from('radar_mission_voice_notes').update({ status }).eq('id', id);
}

async function failNote(supabase: SupabaseClient, id: string, code: string, message: string) {
  await supabase.from('radar_mission_voice_notes').update({
    status: 'failed',
    error_message: `${code}: ${message}`.slice(0, 500),
    processed_at: new Date().toISOString(),
  }).eq('id', id);
  // l'audio n'est JAMAIS supprimé : retry / refaire l'analyse restent possibles.
}

// ---- tâche de fond ----
async function processVoiceNote(supabase: SupabaseClient, voiceNoteId: string) {
  // claim atomique : seul un invoke peut passer 'uploaded'/'failed' → 'transcribing'
  const { data: claimed, error: claimErr } = await supabase
    .from('radar_mission_voice_notes')
    .update({ status: 'transcribing', error_message: null })
    .eq('id', voiceNoteId)
    .in('status', ['uploaded', 'failed'])
    .select('*');

  if (claimErr) return;
  if (!claimed || claimed.length === 0) return; // déjà pris en charge, ou état non éligible
  const vn = claimed[0];

  try {
    const ctx = await fetchContext(supabase, vn);
    let transcript = ((vn.transcript_raw as string) ?? '').trim();

    // réutilise un transcript existant (retry après échec d'analyse) → pas de re-transcription
    if (transcript.length < 3) {
      const { data: audioBlob, error: dlErr } = await supabase.storage.from(BUCKET).download(vn.audio_storage_path as string);
      if (dlErr || !audioBlob) throw new AnalysisError('audio_download_failed', dlErr?.message ?? 'audio introuvable');

      const filename = `voice.${mimeToExt(vn.audio_mime_type as string)}`;
      const r = await transcribe({ audio: audioBlob, filename, language: 'fr', prompt: buildTranscriptionPrompt(ctx) });
      transcript = (r.text ?? '').trim();

      if (transcript.length < 3) {
        await failNote(supabase, voiceNoteId, 'empty_transcript', 'Transcription vide (audio inaudible ou silencieux).');
        return;
      }
      await supabase.from('radar_mission_voice_notes').update({ transcript_raw: transcript }).eq('id', voiceNoteId);
    }

    await setStatus(supabase, voiceNoteId, 'analyzing');
    const payload = await analyzeTranscript(transcript, ctx);

    await supabase.from('radar_mission_voice_notes').update({
      status: 'ready_for_review',
      summary_note: payload.summary_note,
      structured_payload: payload,
      processed_at: new Date().toISOString(),
      error_message: null,
    }).eq('id', voiceNoteId);
  } catch (e) {
    const code = (e && typeof e === 'object' && 'code' in e) ? String((e as { code: string }).code) : 'unknown';
    await failNote(supabase, voiceNoteId, code, e instanceof Error ? e.message : String(e));
  }
}

// ---- point d'entrée ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let voiceNoteId: string | null = null;
  try {
    const body = await req.json();
    voiceNoteId = body?.voice_note_id ?? null;
  } catch (_e) {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!voiceNoteId) return json({ error: 'missing_voice_note_id' }, 400);

  // auth : verify_jwt=false → on identifie l'appelant en code
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabaseAuth.auth.getUser();
  if (!userData?.user) return json({ error: 'not_authenticated' }, 401);

  // contrôle d'accès : lecture RLS-enforced (le membre voit sa ligne, sinon rien)
  const { data: row } = await supabaseAuth
    .from('radar_mission_voice_notes')
    .select('id, status')
    .eq('id', voiceNoteId)
    .maybeSingle();
  if (!row) return json({ error: 'not_found_or_forbidden' }, 404);

  // écritures en service_role ; le front poll le statut de la ligne
  const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  EdgeRuntime.waitUntil(processVoiceNote(supabaseService, voiceNoteId));

  return json({ status: 'accepted', voice_note_id: voiceNoteId, current_status: row.status }, 202);
});