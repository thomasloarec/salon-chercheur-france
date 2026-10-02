// supabase/functions/enrich-program-sessions/index.ts
// Assistant « Pépites », lot 1 : enrichissement IA des sessions de programme.
// Appelée la nuit par pg_cron (service_role) ou à la main par un admin.
// Lit les sessions à traiter via la RPC select_sessions_to_enrich, appelle Claude,
// valide strictement la réponse contre les référentiels, écrit dans session_enrichment.
// Les types « networking » et « remise_prix » sont marqués non suggérables sans appel IA.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { callAnthropic, getAnthropicModelFast } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_VERSION = 'v1';
const MODEL = getAnthropicModelFast();
const BATCH_LIMIT = 80;
const CONCURRENCY = 5;
const NO_LLM_TYPES = new Set(['networking', 'remise_prix']);
const REASONS = new Set(['type_non_contenu', 'logistique', 'protocolaire', 'titre_vague', 'contenu_insuffisant']);
const LEVELS = new Set(['decouverte', 'approfondi', 'tous']);

type SessionRow = {
  session_id: string;
  event_id: string;
  content_hash: string;
  nom_event: string | null;
  event_secteurs: unknown;
  session_type: string | null;
  title: string | null;
  description: string | null;
  track: string | null;
  speakers: Array<{ nom?: string | null; fonction?: string | null; organisation?: string | null }> | null;
};
type RefItem = { code: string; label: string; description: string };
type SubSector = { id: string; name: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function sectorsText(v: unknown): string {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join(', ');
  return typeof v === 'string' ? v : '';
}

function speakersText(sp: SessionRow['speakers']): string {
  if (!sp || sp.length === 0) return 'aucun intervenant renseigné';
  return sp.slice(0, 12).map((p) => {
    const parts = [p.nom, p.fonction, p.organisation].filter((x) => x && String(x).trim());
    return '- ' + parts.join(', ');
  }).join('\n');
}

function buildPrompt(s: SessionRow, themes: RefItem[], roles: RefItem[], subs: SubSector[]): string {
  const desc = (s.description || '').replace(/\s+/g, ' ').trim().slice(0, 2500);
  return `Tu analyses une session du programme d'un salon professionnel pour un assistant qui recommande des conférences à des professionnels. Tu dois rester strictement fidèle aux informations fournies.

SESSION
Salon : ${s.nom_event || ''}
Secteurs du salon : ${sectorsText(s.event_secteurs)}
Type : ${s.session_type || 'non précisé'}
Parcours : ${s.track || 'non précisé'}
Titre : ${s.title || ''}
Description : ${desc || 'aucune'}
Intervenants :
${speakersText(s.speakers)}

THÈMES TRANSVERSAUX (codes autorisés)
${themes.map((t) => `${t.code} : ${t.label} (${t.description})`).join('\n')}

RÔLES (codes autorisés)
${roles.map((r) => `${r.code} : ${r.label} (${r.description})`).join('\n')}

SOUS-SECTEURS (noms autorisés, à recopier exactement)
${subs.map((x) => x.name).join(' | ')}

RÈGLES
1. N'invente aucun fait, chiffre, nom ou résultat. Utilise uniquement le titre, la description, le type, le parcours et les intervenants.
2. is_suggestible = false si la session est logistique (accueil, pause, déjeuner, cocktail, visite libre), protocolaire sans sujet (ouverture officielle, inauguration, remise de prix), ou si on ne peut pas savoir de quoi elle parle (titre vague comme « Conférence plénière », « Partner session », « Formation partie 2 », sans description ni intervenants qui précisent le sujet). Donne alors unsuggestible_reason parmi : logistique, protocolaire, titre_vague, contenu_insuffisant ; et laisse les autres champs vides.
3. summary : une phrase de 160 caractères maximum qui dit concrètement de quoi parle la session et pour qui. Ne répète pas le nom du salon. Pas de tiret cadratin. Pas de superlatif.
4. themes : 0 à 3 codes, uniquement si la session traite réellement du thème (une simple mention ne suffit pas).
5. sous_secteurs : 0 à 3 noms exacts de la liste, les secteurs d'activité concernés par le contenu de la session (pas forcément ceux du salon).
6. roles : 1 à 4 codes, les métiers à qui la session sera le plus utile.
7. niveau : decouverte, approfondi ou tous.
8. problemes : 0 à 3 phrases courtes (80 caractères maximum) qui formulent les questions ou problèmes traités, comme un professionnel les formulerait.
9. mots_cles : 3 à 8 termes utiles pour retrouver la session, y compris des synonymes absents du titre.

RÉPONSE
Uniquement un objet JSON, sans texte autour :
{"is_suggestible": true, "unsuggestible_reason": null, "summary": "...", "themes": [], "sous_secteurs": [], "roles": [], "niveau": "tous", "problemes": [], "mots_cles": []}`;
}

function parseJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function strArray(v: unknown, max: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.replace(/—/g, ',').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    out.push(t.length > maxLen ? t.slice(0, maxLen).trimEnd() : t);
    if (out.length >= max) break;
  }
  return out;
}

function clip(t: string, max: number): string {
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const sp = slice.lastIndexOf(' ');
  return (sp > 0 ? slice.slice(0, sp) : slice).replace(/[,;:\-]+$/g, '').trimEnd();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anthropicKey || !anonKey) {
    return json({ error: 'Missing required secrets' }, 500);
  }

  // Auth : service_role (cron) ou admin authentifié
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice('Bearer '.length);
  if (token !== serviceKey) {
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
    const adminCheck = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleError } = await adminCheck.rpc('has_role', {
      _user_id: claimsData.claims.sub,
      _role: 'admin',
    });
    if (roleError || !isAdmin) return json({ error: 'Forbidden: admin only' }, 403);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let limit = BATCH_LIMIT;
  let dryRun = false;
  try {
    const body = await req.json();
    if (typeof body?.limit === 'number') limit = Math.max(1, Math.min(200, body.limit));
    if (body?.dry_run === true) dryRun = true;
  } catch { /* corps vide accepté */ }

  const [themesRes, rolesRes, subsRes, rowsRes] = await Promise.all([
    supabase.from('assistant_themes').select('code,label,description').order('position'),
    supabase.from('assistant_roles').select('code,label,description').order('position'),
    supabase.from('sub_sectors').select('id,name').order('name'),
    supabase.rpc('select_sessions_to_enrich', { p_limit: limit, p_prompt_version: PROMPT_VERSION }),
  ]);
  const firstError = themesRes.error || rolesRes.error || subsRes.error || rowsRes.error;
  if (firstError) return json({ error: firstError.message }, 500);

  const themes = (themesRes.data ?? []) as RefItem[];
  const roles = (rolesRes.data ?? []) as RefItem[];
  const subs = (subsRes.data ?? []) as SubSector[];
  const rows = (rowsRes.data ?? []) as SessionRow[];
  if (themes.length === 0 || roles.length === 0 || subs.length === 0) {
    return json({ error: 'Référentiels vides : arrêt sans écriture' }, 500);
  }

  const themeCodes = new Set(themes.map((t) => t.code));
  const roleCodes = new Set(roles.map((r) => r.code));
  const subByName = new Map(subs.map((x) => [norm(x.name), x.id]));

  let done = 0, skippedNoLlm = 0, notSuggestible = 0, errors = 0;
  const samples: unknown[] = [];

  async function processOne(s: SessionRow): Promise<void> {
    let record: Record<string, unknown>;
    if (NO_LLM_TYPES.has(s.session_type || '')) {
      record = {
        session_id: s.session_id, event_id: s.event_id, content_hash: s.content_hash,
        is_suggestible: false, unsuggestible_reason: 'type_non_contenu', summary: null,
        theme_codes: [], sub_sector_ids: [], role_codes: [], level: null, problems: [], keywords: [],
        model: null, prompt_version: PROMPT_VERSION, enriched_at: new Date().toISOString(),
      };
      skippedNoLlm++;
    } else {
      const res = await callAnthropic({
        apiKey: anthropicKey!, model: MODEL, userMessage: buildPrompt(s, themes, roles, subs),
        maxTokens: 700, caller: 'enrich-program-sessions',
      });
      if (!res.ok || !res.text) { errors++; return; }
      const out = parseJson(res.text);
      if (!out) { errors++; console.error('[enrich-program-sessions] JSON invalide', s.session_id); return; }

      const suggestible = out.is_suggestible === true;
      let reason: string | null = null;
      if (!suggestible) {
        reason = typeof out.unsuggestible_reason === 'string' && REASONS.has(out.unsuggestible_reason)
          ? out.unsuggestible_reason : 'contenu_insuffisant';
      }
      const summaryRaw = typeof out.summary === 'string' ? out.summary.replace(/—/g, ',').trim() : '';
      const level = typeof out.niveau === 'string' && LEVELS.has(out.niveau) ? out.niveau : 'tous';

      record = {
        session_id: s.session_id, event_id: s.event_id, content_hash: s.content_hash,
        is_suggestible: suggestible,
        unsuggestible_reason: reason,
        summary: suggestible && summaryRaw ? clip(summaryRaw, 200) : null,
        theme_codes: suggestible ? strArray(out.themes, 3, 40).filter((c) => themeCodes.has(c)) : [],
        sub_sector_ids: suggestible
          ? strArray(out.sous_secteurs, 3, 120).map((n) => subByName.get(norm(n))).filter((x): x is string => !!x)
          : [],
        role_codes: suggestible ? strArray(out.roles, 4, 40).filter((c) => roleCodes.has(c)) : [],
        level: suggestible ? level : null,
        problems: suggestible ? strArray(out.problemes, 3, 120) : [],
        keywords: suggestible ? strArray(out.mots_cles, 8, 60) : [],
        model: res.model, prompt_version: PROMPT_VERSION, enriched_at: new Date().toISOString(),
      };
      if (!suggestible) notSuggestible++;
    }

    if (samples.length < 5) samples.push({ title: s.title, ...record });
    if (dryRun) { done++; return; }

    const { error } = await supabase.from('session_enrichment').upsert(record, { onConflict: 'session_id' });
    if (error) { errors++; console.error('[enrich-program-sessions] upsert', s.session_id, error.message); return; }
    done++;
  }

  let idx = 0;
  async function worker() {
    while (idx < rows.length) {
      const my = idx++;
      try { await processOne(rows[my]); } catch (e) {
        errors++;
        console.error('[enrich-program-sessions] inattendu', rows[my].session_id, (e as Error).message);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()));

  return json({
    prompt_version: PROMPT_VERSION, model: MODEL, dry_run: dryRun,
    selectionnees: rows.length, ecrites: dryRun ? 0 : done, sans_ia: skippedNoLlm,
    non_suggerables: notSuggestible, erreurs: errors, exemples: samples,
  });
});
