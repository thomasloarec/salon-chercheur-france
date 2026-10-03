// supabase/functions/enrich-novelties/index.ts
// Assistant « Pépites », lot 2a : lecture IA des Nouveautés (même schéma que les conférences).
// Appelée toutes les heures par pg_cron (service_role) ou à la main par un admin.
// Lit les Nouveautés à traiter via la RPC select_novelties_to_enrich, appelle Claude,
// valide strictement la réponse contre les référentiels, écrit dans novelty_enrichment.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { callAnthropic, getAnthropicModelFast } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_VERSION = 'v2';
const MODEL = getAnthropicModelFast();
const BATCH_LIMIT = 60;
const CONCURRENCY = 5;
const REASONS = new Set(['titre_vague', 'contenu_insuffisant']);
const LEVELS = new Set(['decouverte', 'approfondi', 'tous']);

type NoveltyRow = {
  novelty_id: string;
  event_id: string;
  content_hash: string;
  nom_event: string | null;
  event_secteurs: unknown;
  exhibitor_name: string | null;
  novelty_type: string | null;
  title: string | null;
  summary: string | null;
  reason_1: string | null;
  reason_2: string | null;
  reason_3: string | null;
  details: string | null;
  audience_tags: string[] | null;
  stand_info: string | null;
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

function clean(t: string | null, max: number): string {
  return (t || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildPrompt(n: NoveltyRow, themes: RefItem[], roles: RefItem[], subs: SubSector[]): string {
  const tags = (n.audience_tags || []).filter(Boolean).join(', ');
  return `Tu analyses une Nouveauté qu'une entreprise présente sur un salon professionnel, pour un assistant qui recommande des Nouveautés à des professionnels. Tu dois rester strictement fidèle aux informations fournies.

NOUVEAUTÉ
Salon : ${n.nom_event || ''}
Secteurs du salon : ${sectorsText(n.event_secteurs)}
Entreprise : ${n.exhibitor_name || 'non précisée'}
Type : ${n.novelty_type || 'non précisé'}
Titre : ${clean(n.title, 200)}
Résumé : ${clean(n.summary, 800) || 'aucun'}
Raison 1 : ${clean(n.reason_1, 800) || 'aucune'}
Raison 2 : ${clean(n.reason_2, 600) || 'aucune'}
Raison 3 : ${clean(n.reason_3, 600) || 'aucune'}
Détails : ${clean(n.details, 1500) || 'aucun'}
Public visé : ${tags || 'non précisé'}

THÈMES TRANSVERSAUX (codes autorisés)
${themes.map((t) => `${t.code} : ${t.label} (${t.description})`).join('\n')}

RÔLES (codes autorisés)
${roles.map((r) => `${r.code} : ${r.label} (${r.description})`).join('\n')}

SOUS-SECTEURS (noms autorisés, à recopier exactement)
${subs.map((x) => x.name).join(' | ')}

RÈGLES
1. N'invente aucun fait, chiffre, nom ou résultat. Utilise uniquement les informations ci-dessus.
2. is_suggestible = false seulement si on ne peut pas savoir ce que présente l'entreprise (titre vague et aucun texte qui précise). Donne alors unsuggestible_reason parmi : titre_vague, contenu_insuffisant ; et laisse les autres champs vides.
2 bis. promesse : si la Nouveauté est suggérable, une phrase de 140 caractères maximum qui commence par un verbe à l'infinitif (Voir, Découvrir, Tester, Comparer, Apprendre) et dit concrètement ce que le visiteur verra ou pourra faire sur le stand. Exemple : « Voir en démonstration une grue sur remorque 100 % électrique tractable par un véhicule léger ». Uniquement des éléments présents dans les informations fournies.
3. summary : une phrase de 160 caractères maximum qui dit concrètement ce qui est présenté et pour qui. Ne répète pas le nom du salon. Pas de tiret cadratin. Pas de superlatif ni de ton publicitaire.
4. themes : 0 à 3 codes, uniquement si la Nouveauté relève réellement du thème.
5. sous_secteurs : 1 à 3 noms exacts de la liste : les secteurs d'activité des clients à qui la Nouveauté s'adresse, et le secteur de l'entreprise si c'est pertinent.
6. roles : 1 à 4 codes, les métiers à qui la Nouveauté sera le plus utile.
7. niveau : decouverte, approfondi ou tous.
8. problemes : 0 à 3 phrases courtes (80 caractères maximum) qui formulent les besoins auxquels répond la Nouveauté, comme un professionnel les formulerait.
9. mots_cles : 3 à 8 termes utiles pour retrouver la Nouveauté, y compris des synonymes absents du titre. N'ajoute aucun nom propre (organisme, programme public, marque, produit) qui ne figure pas dans les informations fournies.

RÉPONSE
Uniquement un objet JSON, sans texte autour :
{"is_suggestible": true, "unsuggestible_reason": null, "promesse": "...", "summary": "...", "themes": [], "sous_secteurs": [], "roles": [], "niveau": "tous", "problemes": [], "mots_cles": []}`;
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
    supabase.rpc('select_novelties_to_enrich', { p_limit: limit, p_prompt_version: PROMPT_VERSION }),
  ]);
  const firstError = themesRes.error || rolesRes.error || subsRes.error || rowsRes.error;
  if (firstError) return json({ error: firstError.message }, 500);

  const themes = (themesRes.data ?? []) as RefItem[];
  const roles = (rolesRes.data ?? []) as RefItem[];
  const subs = (subsRes.data ?? []) as SubSector[];
  const rows = (rowsRes.data ?? []) as NoveltyRow[];
  if (themes.length === 0 || roles.length === 0 || subs.length === 0) {
    return json({ error: 'Référentiels vides : arrêt sans écriture' }, 500);
  }

  const themeCodes = new Set(themes.map((t) => t.code));
  const roleCodes = new Set(roles.map((r) => r.code));
  const subByName = new Map(subs.map((x) => [norm(x.name), x.id]));

  let done = 0, notSuggestible = 0, errors = 0;
  const samples: unknown[] = [];

  async function processOne(n: NoveltyRow): Promise<void> {
    const res = await callAnthropic({
      apiKey: anthropicKey!, model: MODEL, userMessage: buildPrompt(n, themes, roles, subs),
      maxTokens: 700, caller: 'enrich-novelties',
    });
    if (!res.ok || !res.text) { errors++; return; }
    const out = parseJson(res.text);
    if (!out) { errors++; console.error('[enrich-novelties] JSON invalide', n.novelty_id); return; }

    const suggestible = out.is_suggestible === true;
    let reason: string | null = null;
    if (!suggestible) {
      reason = typeof out.unsuggestible_reason === 'string' && REASONS.has(out.unsuggestible_reason)
        ? out.unsuggestible_reason : 'contenu_insuffisant';
    }
    const summaryRaw = typeof out.summary === 'string' ? out.summary.replace(/—/g, ',').trim() : '';
    const promiseRaw = typeof out.promesse === 'string' ? out.promesse.replace(/—/g, ',').replace(/\s+/g, ' ').trim() : '';
    const level = typeof out.niveau === 'string' && LEVELS.has(out.niveau) ? out.niveau : 'tous';

    const record = {
      novelty_id: n.novelty_id, event_id: n.event_id, content_hash: n.content_hash,
      is_suggestible: suggestible,
      unsuggestible_reason: reason,
      summary: suggestible && summaryRaw ? clip(summaryRaw, 200) : null,
      promise: suggestible && promiseRaw ? clip(promiseRaw, 180) : null,
      theme_codes: suggestible ? strArray(out.themes, 3, 40).filter((c) => themeCodes.has(c)) : [],
      sub_sector_ids: suggestible
        ? strArray(out.sous_secteurs, 3, 120).map((x) => subByName.get(norm(x))).filter((x): x is string => !!x)
        : [],
      role_codes: suggestible ? strArray(out.roles, 4, 40).filter((c) => roleCodes.has(c)) : [],
      level: suggestible ? level : null,
      problems: suggestible ? strArray(out.problemes, 3, 120) : [],
      keywords: suggestible ? strArray(out.mots_cles, 8, 60) : [],
      model: res.model, prompt_version: PROMPT_VERSION, enriched_at: new Date().toISOString(),
    };
    if (!suggestible) notSuggestible++;

    if (samples.length < 5) samples.push({ title: n.title, ...record });
    if (dryRun) { done++; return; }

    const { error } = await supabase.from('novelty_enrichment').upsert(record, { onConflict: 'novelty_id' });
    if (error) { errors++; console.error('[enrich-novelties] upsert', n.novelty_id, error.message); return; }
    done++;
  }

  let idx = 0;
  async function worker() {
    while (idx < rows.length) {
      const my = idx++;
      try { await processOne(rows[my]); } catch (e) {
        errors++;
        console.error('[enrich-novelties] inattendu', rows[my].novelty_id, (e as Error).message);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()));

  return json({
    prompt_version: PROMPT_VERSION, model: MODEL, dry_run: dryRun,
    selectionnees: rows.length, ecrites: dryRun ? 0 : done,
    non_suggerables: notSuggestible, erreurs: errors, exemples: samples,
  });
});
