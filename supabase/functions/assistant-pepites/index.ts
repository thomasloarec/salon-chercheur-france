// supabase/functions/assistant-pepites/index.ts
// Assistant « Pépites » : le moteur de pépites pour UN profil (lot 2b, boucle d'apprentissage au lot 4).
// Appelée par le serveur (service_role), par un admin, ou (lot 3) par l'utilisateur pour SON assistant,
// y compris pendant l'onboarding sous une session anonyme. Quotas par 24 h : assistant_engine_run_allowed.
//
// Corps : { "profile_id": "...", "step": "all" | "pistes" | "match" | "adapt", "days_from": 0, "days_to": 60,
//           "preview": false }
//   profile_id : facultatif pour l'utilisateur (son assistant est retrouvé), obligatoire pour le serveur
//   preview    : relecture plafonnée à 45 éléments (onboarding) ; toujours vrai pour une session anonyme.
//                Après un aperçu, un compte reçoit la recherche complète par la tâche planifiée.
//   L'utilisateur ne peut lancer que « all », « pistes » ou « match » sur la fenêtre par défaut.
//   pistes : l'IA tire 3 à 5 pistes du profil, puis leurs vecteurs sont calculés (RPC embed_assistant_pistes)
//   match  : présélection + croisement (RPC assistant_candidates, qui applique les retours de l'utilisateur),
//            relecture IA (score 0-100 + raison, avec les derniers retours), écriture des pépites
//            (assistant_matches) et des salons suggérés (assistant_suggestions)
//   adapt  : après des retours (tâche planifiée assistant-refresh-feedback) : remplace les pistes refusées
//            deux fois pour « Pas ce sujet », ajuste les vecteurs des pistes (RPC assistant_tune_pistes), puis match
//   all    : pistes puis match (défaut)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { callAnthropic, getAnthropicModelFast, getAnthropicModelStrong } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = getAnthropicModelStrong();
const MODEL_FAST = getAnthropicModelFast();
const RETAIN_SCORE = 70;        // une pépite est retenue à partir de ce score
const STRONG_SCORE = 90;        // une seule pépite suffit si elle atteint ce score et croise le secteur
const REVIEW_CHUNK = 15;        // éléments relus par appel à Claude
const REVIEW_CONCURRENCY = 4;
const MAX_REVIEWED = 90;        // plafond d'éléments relus par profil
const PREVIEW_MAX_REVIEWED = 45; // aperçu de l'onboarding (trois paquets relus en parallèle)
const WEAK_RETAIN_SCORE = 80;   // seuil pour une piste affaiblie par des « Pas pour moi » répétés
const GOAL_LABELS: Record<string, string> = {
  fournisseurs: 'trouver des fournisseurs ou des solutions',
  clients: 'rencontrer des clients ou prospects',
  veille: 'faire de la veille',
  formation: 'se former',
  partenaires: 'trouver des partenaires',
};

type Profile = {
  id: string; user_id: string | null; label: string | null; company_name: string | null; company_description: string | null;
  sector_ids: string[]; sub_sector_ids: string[]; role_code: string | null;
  role_codes: string[] | null; role_other: string | null;
  interests: string[]; goals: string[];
};

// Tous les rôles choisis (lot 3d ter), avec repli sur le rôle unique des profils plus anciens.
function profileRoleCodes(p: Profile): string[] {
  const list = (p.role_codes ?? []).filter(Boolean);
  return list.length ? list : (p.role_code ? [p.role_code] : []);
}
type RefItem = { code: string; label: string; description: string };
type SubSector = { id: string; name: string; sector_id: string };
type Sector = { id: string; name: string };
type Candidate = {
  piste_id: string; item_type: 'session' | 'novelty'; item_id: string; event_id: string;
  similarity: number; sector_match: boolean; role_match: boolean; theme_match: boolean; passes: boolean;
};
type Item = {
  key: string; type: 'session' | 'novelty'; id: string; event_id: string; title: string;
  summary: string; promise: string; problems: string[]; extra: string; when: string;
};
type Recent = { signal: string; reason: string | null; item_type: string | null; title: string | null; piste: string | null };
type Adjustments = {
  excluded_items: { item_type: 'session' | 'novelty'; item_id: string }[];
  excluded_event_ids: string[];
  excluded_series_ids: string[];
  blocked_sector_ids: string[];
  replace_piste_ids: string[];
  weak_piste_ids: string[];
  require_sector: boolean;
  propose_distance: boolean;
  recent: Recent[];
  feedback_count: number;
};
const EMPTY_ADJ: Adjustments = {
  excluded_items: [], excluded_event_ids: [], excluded_series_ids: [], blocked_sector_ids: [],
  replace_piste_ids: [], weak_piste_ids: [], require_sector: false, propose_distance: false,
  recent: [], feedback_count: 0,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Clé de doublon : ignore les marqueurs de rediffusion (« (V1) », « (V2) », « - session 2 »…)
function titleKey(t: string): string {
  return norm(t)
    .replace(/\b(v|version|session|seance|partie|part)\s*\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(t: string | null | undefined, max: number): string {
  return (t || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clip(t: string, max: number): string {
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const sp = slice.lastIndexOf(' ');
  return (sp > 0 ? slice.slice(0, sp) : slice).replace(/[,;:\-]+$/g, '').trimEnd();
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

function frDate(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return y && m && day ? `${day}/${m}/${y}` : d;
}

async function loadRefs(supabase: SupabaseClient) {
  const [themesRes, rolesRes, subsRes, sectorsRes] = await Promise.all([
    supabase.from('assistant_themes').select('code,label,description').order('position'),
    supabase.from('assistant_roles').select('code,label,description').order('position'),
    supabase.from('sub_sectors').select('id,name,sector_id').order('name'),
    supabase.from('sectors').select('id,name').order('name'),
  ]);
  const err = themesRes.error || rolesRes.error || subsRes.error || sectorsRes.error;
  if (err) throw new Error(err.message);
  return {
    themes: (themesRes.data ?? []) as RefItem[],
    roles: (rolesRes.data ?? []) as RefItem[],
    subs: (subsRes.data ?? []) as SubSector[],
    sectors: (sectorsRes.data ?? []) as Sector[],
  };
}

type Refs = Awaited<ReturnType<typeof loadRefs>>;

function profileText(p: Profile, refs: Refs): string {
  const sectorNames = refs.sectors.filter((s) => p.sector_ids.includes(s.id)).map((s) => s.name);
  const subNames = refs.subs.filter((s) => p.sub_sector_ids.includes(s.id)).map((s) => s.name);
  const roleLabels = profileRoleCodes(p)
    .map((c) => refs.roles.find((r) => r.code === c)?.label)
    .filter((l): l is string => !!l);
  if (p.role_other) roleLabels.push(`${clean(p.role_other, 80)} (décrit par la personne)`);
  const goals = p.goals.map((g) => GOAL_LABELS[g] || g);
  return [
    `Métier : ${p.label || 'non précisé'}`,
    `Entreprise : ${p.company_name || 'non précisée'}${p.company_description ? ` (${clean(p.company_description, 500)})` : ''}`,
    `Secteurs : ${[...sectorNames, ...subNames].join(', ') || 'non précisés'}`,
    `Rôle : ${roleLabels.join(', ') || 'non précisé'}`,
    `Centres d'intérêt professionnels : ${p.interests.join(' ; ') || 'non précisés'}`,
    `Ce qu'il cherche sur un salon : ${goals.join(', ') || 'non précisé'}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Étape « pistes »
// ---------------------------------------------------------------------------------------------
function pistesPrompt(p: Profile, refs: Refs): string {
  return `Tu prépares la recherche d'un assistant qui signale à un professionnel les conférences et les Nouveautés d'exposants qui valent le déplacement pour lui sur les salons professionnels.

PROFIL
${profileText(p, refs)}

THÈMES TRANSVERSAUX (codes autorisés)
${refs.themes.map((t) => `${t.code} : ${t.label}`).join('\n')}

RÔLES (codes autorisés)
${refs.roles.map((r) => `${r.code} : ${r.label}`).join('\n')}

SOUS-SECTEURS (noms autorisés, à recopier exactement)
${refs.subs.map((x) => x.name).join(' | ')}

TA TÂCHE
Déduis du profil 3 à 5 pistes de recherche. Une piste est un sujet professionnel précis sur lequel une conférence ou une Nouveauté lui serait vraiment utile.

RÈGLES
1. Chaque piste croise un centre d'intérêt du profil avec son activité, son secteur ou son métier. Exemple : « Intelligence artificielle appliquée à la conception de machines agricoles », et non « Intelligence artificielle ».
2. Couvre les différents centres d'intérêt du profil. N'ajoute aucun sujet qu'il n'a pas exprimé et qui ne découle pas directement de son métier.
3. label : 6 à 16 mots, en français, sans tiret cadratin.
4. themes : 0 à 2 codes, seulement si la piste relève vraiment du thème.
5. sous_secteurs : 1 à 3 noms exacts de la liste : le secteur d'activité du profil et, si la piste porte sur ses clients ou ses marchés, le secteur de ces clients.
6. roles : 1 à 3 codes : le rôle du profil et, si utile, les rôles proches.
7. generique : true si la piste est surtout un thème transversal (IA, cybersécurité, RSE, financement, recrutement, réglementation…) appliqué à son activité ; false si c'est un sujet propre à son métier ou à son secteur (exemple : maladies de la vigne).
8. N'invente rien sur l'entreprise.
9. court : 2 à 4 mots qui nomment le sujet de la piste, affichés sur un bouton (exemple : « IA et conception »). Sans article au début, sans tiret cadratin.

RÉPONSE
Uniquement un objet JSON, sans texte autour :
{"pistes": [{"label": "...", "court": "...", "themes": [], "sous_secteurs": [], "roles": [], "generique": false}]}`;
}

async function buildPistes(supabase: SupabaseClient, anthropicKey: string, p: Profile, refs: Refs) {
  const res = await callAnthropic({
    apiKey: anthropicKey, model: MODEL, userMessage: pistesPrompt(p, refs),
    maxTokens: 1500, caller: 'assistant-pepites:pistes',
  });
  if (!res.ok || !res.text) throw new Error(`Claude pistes : ${res.error || 'réponse vide'}`);
  const out = parseJson(res.text);
  const raw = Array.isArray(out?.pistes) ? (out!.pistes as Record<string, unknown>[]) : [];
  if (raw.length === 0) throw new Error('Claude pistes : JSON invalide ou vide');

  const themeCodes = new Set(refs.themes.map((t) => t.code));
  const roleCodes = new Set(refs.roles.map((r) => r.code));
  const subByName = new Map(refs.subs.map((x) => [norm(x.name), x]));

  const rows = raw.slice(0, 5).map((x, i) => {
    const label = clip(clean(typeof x.label === 'string' ? x.label.replace(/—/g, ',') : '', 200), 160);
    const themes = strArray(x.themes, 2, 40).filter((c) => themeCodes.has(c));
    let subs = strArray(x.sous_secteurs, 3, 120)
      .map((n) => subByName.get(norm(n))).filter((s): s is SubSector => !!s);
    if (subs.length === 0) subs = refs.subs.filter((s) => p.sub_sector_ids.includes(s.id));
    let roles = strArray(x.roles, 3, 40).filter((c) => roleCodes.has(c));
    if (roles.length === 0) roles = profileRoleCodes(p).slice(0, 3);
    const subIds = [...new Set(subs.map((s) => s.id))];
    const sectorIds = [...new Set(subs.map((s) => s.sector_id))];
    return {
      profile_id: p.id, position: i, label, short_label: shortLabel(x.court),
      theme_codes: themes, sub_sector_ids: subIds, sector_ids: sectorIds, role_codes: roles,
      // une piste générique sans thème reconnu ne pourrait jamais passer le croisement
      is_generic: x.generique === true && themes.length > 0,
      active: true, model: res.model,
    };
  }).filter((r) => r.label.length >= 5);
  if (rows.length === 0) throw new Error('Claude pistes : aucune piste exploitable');

  // Les anciennes pistes qui portent des retours sont désactivées (leurs retours restent attachés) ;
  // les autres sont supprimées.
  const fbRes = await supabase.from('assistant_feedback').select('piste_id')
    .eq('profile_id', p.id).not('piste_id', 'is', null);
  if (fbRes.error) throw new Error(fbRes.error.message);
  const withFeedback = [...new Set(((fbRes.data ?? []) as { piste_id: string }[]).map((f) => f.piste_id))];
  if (withFeedback.length) {
    const off = await supabase.from('assistant_pistes').update({ active: false })
      .eq('profile_id', p.id).in('id', withFeedback);
    if (off.error) throw new Error(off.error.message);
  }
  let del = supabase.from('assistant_pistes').delete().eq('profile_id', p.id);
  if (withFeedback.length) del = del.not('id', 'in', `(${withFeedback.join(',')})`);
  const delRes = await del;
  if (delRes.error) throw new Error(delRes.error.message);
  const ins = await supabase.from('assistant_pistes').insert(rows);
  if (ins.error) throw new Error(ins.error.message);

  await embedPistes(supabase, p.id);
  return rows.map((r) => ({ label: r.label, court: r.short_label, themes: r.theme_codes, generique: r.is_generic }));
}

// Libellé court d'une piste (bouton « Pas ce sujet (…) ») : 2 à 4 mots, 40 caractères au plus.
function shortLabel(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/—/g, ',').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/g, '');
  if (t.length < 3) return null;
  const words = t.split(' ').slice(0, 5).join(' ');
  return clip(words, 40) || null;
}

// Les pistes sans libellé court (modifiées par l'utilisateur, ou créées avant le lot 3) en reçoivent un,
// en un seul appel au modèle rapide. Sans réponse exploitable, le site affiche le libellé complet.
async function fillShortLabels(supabase: SupabaseClient, anthropicKey: string, profileId: string) {
  const r = await supabase.from('assistant_pistes').select('id,label')
    .eq('profile_id', profileId).eq('active', true).is('short_label', null);
  if (r.error) throw new Error(r.error.message);
  const list = (r.data ?? []) as { id: string; label: string }[];
  if (list.length === 0) return 0;
  const res = await callAnthropic({
    apiKey: anthropicKey, model: MODEL_FAST, maxTokens: 400, caller: 'assistant-pepites:court',
    userMessage: `Pour chaque sujet ci-dessous, donne un libellé de 2 à 4 mots qui le nomme, affiché sur un bouton (exemple : « IA et conception »). En français, sans article au début, sans tiret cadratin.

${list.map((x, i) => `${i + 1}. ${x.label}`).join('\n')}

Uniquement un objet JSON, sans texte autour : {"courts": [{"i": 1, "court": "..."}]}`,
  });
  const out = res.ok && res.text ? parseJson(res.text) : null;
  const courts = Array.isArray(out?.courts) ? (out!.courts as Record<string, unknown>[]) : [];
  let n = 0;
  for (const c of courts) {
    const j = Number(c.i);
    const s = shortLabel(c.court);
    if (!Number.isInteger(j) || j < 1 || j > list.length || !s) continue;
    const up = await supabase.from('assistant_pistes').update({ short_label: s }).eq('id', list[j - 1].id);
    if (!up.error) n++;
  }
  return n;
}

// Le service de vecteurs peut ne pas répondre ponctuellement : jusqu'à 3 tentatives.
async function embedPistes(supabase: SupabaseClient, profileId: string) {
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const emb = await supabase.rpc('embed_assistant_pistes', { p_profile_id: profileId });
    if (!emb.error) {
      const left = await supabase.from('assistant_pistes').select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId).eq('active', true).is('embedding', null);
      if (!left.error && (left.count ?? 0) === 0) { lastErr = ''; break; }
      lastErr = `${left.count ?? '?'} pistes sans vecteur`;
    } else {
      lastErr = emb.error.message;
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  if (lastErr) throw new Error(`Vecteurs des pistes : ${lastErr}`);
}

// ---------------------------------------------------------------------------------------------
// Retours de l'utilisateur
// ---------------------------------------------------------------------------------------------
async function loadAdjustments(supabase: SupabaseClient, profileId: string): Promise<Adjustments> {
  const res = await supabase.rpc('assistant_profile_adjustments', { p_profile_id: profileId });
  if (res.error) throw new Error(`Retours : ${res.error.message}`);
  const a = (res.data ?? {}) as Partial<Adjustments>;
  return {
    excluded_items: Array.isArray(a.excluded_items) ? a.excluded_items : [],
    excluded_event_ids: Array.isArray(a.excluded_event_ids) ? a.excluded_event_ids : [],
    excluded_series_ids: Array.isArray(a.excluded_series_ids) ? a.excluded_series_ids : [],
    blocked_sector_ids: Array.isArray(a.blocked_sector_ids) ? a.blocked_sector_ids : [],
    replace_piste_ids: Array.isArray(a.replace_piste_ids) ? a.replace_piste_ids : [],
    weak_piste_ids: Array.isArray(a.weak_piste_ids) ? a.weak_piste_ids : [],
    require_sector: a.require_sector === true,
    propose_distance: a.propose_distance === true,
    recent: Array.isArray(a.recent) ? a.recent : [],
    feedback_count: typeof a.feedback_count === 'number' ? a.feedback_count : 0,
  };
}

function recentLine(r: Recent): string {
  const t = `« ${clean(r.title, 160)} »`;
  if (r.signal === 'agenda') return `- A ajouté à son agenda : ${t}`;
  if (r.signal === 'inscription') return `- S'est inscrit : ${t}`;
  if (r.signal === 'rdv') return `- A demandé un rendez-vous : ${t}`;
  if (r.reason === 'sujet') return `- N'en veut pas (pas ce sujet) : ${t}`;
  if (r.reason === 'secteur') return `- N'en veut pas (pas son secteur) : ${t}`;
  if (r.reason === 'trop_general') return `- N'en veut pas (trop général pour lui) : ${t}`;
  return `- N'en veut pas : ${t}`;
}

function replacementPrompt(
  p: Profile, refs: Refs, oldLabel: string, refused: string[], liked: string[], others: string[], dropped: string[],
): string {
  return `Tu prépares la recherche d'un assistant qui signale à un professionnel les conférences et les Nouveautés d'exposants qui valent le déplacement pour lui sur les salons professionnels.

PROFIL
${profileText(p, refs)}

PISTE À REMPLACER
« ${oldLabel} »
Il a refusé plusieurs éléments trouvés par cette piste en répondant « Pas ce sujet » :
${refused.map((t) => `- « ${t} »`).join('\n') || '- (titres indisponibles)'}
${liked.length ? `Il a apprécié, sur cette piste :\n${liked.map((t) => `- « ${t} »`).join('\n')}\n` : ''}
AUTRES PISTES ACTIVES (ne pas les répéter)
${others.map((t) => `- ${t}`).join('\n') || '- aucune'}
${dropped.length ? `\nPISTES DÉJÀ ÉCARTÉES (ne pas y revenir)\n${dropped.map((t) => `- ${t}`).join('\n')}\n` : ''}
THÈMES TRANSVERSAUX (codes autorisés)
${refs.themes.map((t) => `${t.code} : ${t.label}`).join('\n')}

RÔLES (codes autorisés)
${refs.roles.map((r) => `${r.code} : ${r.label}`).join('\n')}

SOUS-SECTEURS (noms autorisés, à recopier exactement)
${refs.subs.map((x) => x.name).join(' | ')}

TA TÂCHE
Propose UNE nouvelle piste qui sert toujours ses centres d'intérêt déclarés, mais sous un angle différent de ce qu'il a refusé. Déduis de ses refus ce qui ne l'intéresse pas (le sujet lui-même, ou seulement l'angle) et évite-le. Si aucun angle sérieux ne reste, réponds {"piste": null}.

RÈGLES
1. La piste croise un centre d'intérêt du profil avec son activité, son secteur ou son métier.
2. N'ajoute aucun sujet qu'il n'a pas exprimé et qui ne découle pas directement de son métier.
3. label : 6 à 16 mots, en français, sans tiret cadratin.
4. themes : 0 à 2 codes, seulement si la piste relève vraiment du thème.
5. sous_secteurs : 1 à 3 noms exacts de la liste.
6. roles : 1 à 3 codes.
7. generique : true si la piste est surtout un thème transversal appliqué à son activité ; sinon false.
8. N'invente rien sur l'entreprise.
9. court : 2 à 4 mots qui nomment le sujet de la piste, affichés sur un bouton. Sans article au début, sans tiret cadratin.

RÉPONSE
Uniquement un objet JSON, sans texte autour :
{"piste": {"label": "...", "court": "...", "themes": [], "sous_secteurs": [], "roles": [], "generique": false}}`;
}

// Remplace les pistes refusées deux fois pour « Pas ce sujet ». L'ancienne piste est désactivée (jamais
// supprimée) : ses retours restent attachés et elle sert de contre-exemple pour les remplacements suivants.
async function replacePistes(
  supabase: SupabaseClient, anthropicKey: string, p: Profile, refs: Refs, adj: Adjustments,
) {
  const done: { ancienne: string; nouvelle: string | null }[] = [];
  if (adj.replace_piste_ids.length === 0) return done;

  const pRes = await supabase.from('assistant_pistes')
    .select('id,position,label,active').eq('profile_id', p.id);
  if (pRes.error) throw new Error(pRes.error.message);
  const pistes = (pRes.data ?? []) as { id: string; position: number; label: string; active: boolean }[];

  const themeCodes = new Set(refs.themes.map((t) => t.code));
  const roleCodes = new Set(refs.roles.map((r) => r.code));
  const subByName = new Map(refs.subs.map((x) => [norm(x.name), x]));

  for (const pisteId of adj.replace_piste_ids) {
    const old = pistes.find((x) => x.id === pisteId && x.active);
    if (!old) continue;

    const fbRes = await supabase.from('assistant_feedback')
      .select('signal,reason,item_type,item_id').eq('profile_id', p.id).eq('piste_id', pisteId).is('undone_at', null);
    if (fbRes.error) throw new Error(fbRes.error.message);
    const fbs = (fbRes.data ?? []) as { signal: string; reason: string | null; item_type: string; item_id: string }[];
    const sIds = fbs.filter((f) => f.item_type === 'session').map((f) => f.item_id);
    const nIds = fbs.filter((f) => f.item_type === 'novelty').map((f) => f.item_id);
    const titles = new Map<string, string>();
    if (sIds.length) {
      const r = await supabase.from('event_program_sessions').select('id,title').in('id', sIds);
      for (const x of (r.data ?? []) as { id: string; title: string }[]) titles.set(x.id, clean(x.title, 160));
    }
    if (nIds.length) {
      const r = await supabase.from('novelties').select('id,title').in('id', nIds);
      for (const x of (r.data ?? []) as { id: string; title: string }[]) titles.set(x.id, clean(x.title, 160));
    }
    const refused = fbs.filter((f) => f.signal === 'pas_pour_moi' && f.reason === 'sujet')
      .map((f) => titles.get(f.item_id)).filter((t): t is string => !!t);
    const liked = fbs.filter((f) => ['agenda', 'inscription', 'rdv'].includes(f.signal))
      .map((f) => titles.get(f.item_id)).filter((t): t is string => !!t);
    const others = pistes.filter((x) => x.active && x.id !== pisteId).map((x) => x.label);
    const dropped = pistes.filter((x) => !x.active).map((x) => x.label);

    const res = await callAnthropic({
      apiKey: anthropicKey, model: MODEL,
      userMessage: replacementPrompt(p, refs, old.label, refused, liked, others, dropped),
      maxTokens: 800, caller: 'assistant-pepites:replace',
    });
    if (!res.ok || !res.text) throw new Error(`Claude remplacement : ${res.error || 'réponse vide'}`);
    const out = parseJson(res.text);
    if (!out || !('piste' in out)) throw new Error('Claude remplacement : JSON invalide');

    let newId: string | null = null;
    let newLabel: string | null = null;
    const x = out.piste as Record<string, unknown> | null;
    if (x && typeof x.label === 'string') {
      const label = clip(clean(x.label.replace(/—/g, ','), 200), 160);
      const themes = strArray(x.themes, 2, 40).filter((c) => themeCodes.has(c));
      let subs = strArray(x.sous_secteurs, 3, 120)
        .map((n) => subByName.get(norm(n))).filter((s): s is SubSector => !!s);
      if (subs.length === 0) subs = refs.subs.filter((s) => p.sub_sector_ids.includes(s.id));
      let roles = strArray(x.roles, 3, 40).filter((c) => roleCodes.has(c));
      if (roles.length === 0) roles = profileRoleCodes(p).slice(0, 3);
      if (label.length >= 5) {
        const ins = await supabase.from('assistant_pistes').insert({
          profile_id: p.id, position: old.position, label, short_label: shortLabel(x.court),
          theme_codes: themes, sub_sector_ids: [...new Set(subs.map((s) => s.id))],
          sector_ids: [...new Set(subs.map((s) => s.sector_id))], role_codes: roles,
          is_generic: x.generique === true && themes.length > 0,
          active: true, origin: 'replacement', model: res.model,
        }).select('id').single();
        if (ins.error) throw new Error(ins.error.message);
        newId = (ins.data as { id: string }).id;
        newLabel = label;
      }
    }
    const upd = await supabase.from('assistant_pistes')
      .update({ active: false, replaced_by: newId }).eq('id', pisteId);
    if (upd.error) throw new Error(upd.error.message);
    done.push({ ancienne: old.label, nouvelle: newLabel });
  }
  if (done.some((d) => d.nouvelle)) await embedPistes(supabase, p.id);
  return done;
}

// ---------------------------------------------------------------------------------------------
// Étape « match »
// ---------------------------------------------------------------------------------------------
async function loadItems(supabase: SupabaseClient, sessionIds: string[], noveltyIds: string[]) {
  const items = new Map<string, Item>();

  if (sessionIds.length > 0) {
    const [sRes, eRes, spRes] = await Promise.all([
      supabase.from('event_program_sessions')
        .select('id,event_id,title,description,session_type,day_date,start_time').in('id', sessionIds),
      supabase.from('session_enrichment').select('session_id,summary,promise,problems').in('session_id', sessionIds),
      supabase.from('event_program_session_speakers')
        .select('session_id,position,event_program_speakers(full_name,job_title,company)')
        .in('session_id', sessionIds),
    ]);
    if (sRes.error) throw new Error(sRes.error.message);
    if (eRes.error) throw new Error(eRes.error.message);
    const enr = new Map(((eRes.data ?? []) as Record<string, unknown>[]).map((r) => [r.session_id as string, r]));
    const speakers = new Map<string, string[]>();
    if (!spRes.error) {
      for (const r of (spRes.data ?? []) as Record<string, unknown>[]) {
        const sp = r.event_program_speakers as Record<string, string | null> | null;
        if (!sp) continue;
        const txt = [sp.job_title, sp.company].filter((x) => x && String(x).trim()).join(', ');
        if (!txt) continue;
        const list = speakers.get(r.session_id as string) ?? [];
        if (list.length < 4) list.push(txt);
        speakers.set(r.session_id as string, list);
      }
    }
    for (const s of (sRes.data ?? []) as Record<string, string | null>[]) {
      const e = enr.get(s.id as string) as unknown as { summary: string | null; promise: string | null; problems: string[] | null } | undefined;
      const sp = speakers.get(s.id as string) ?? [];
      items.set(`session:${s.id}`, {
        key: `session:${s.id}`, type: 'session', id: s.id as string, event_id: s.event_id as string,
        title: clean(s.title, 200),
        summary: clean(e?.summary || s.description, 300),
        promise: clean(e?.promise, 200),
        problems: (e?.problems ?? []).slice(0, 3),
        extra: [clean(s.description, 400) ? `Description : ${clean(s.description, 400)}` : '',
                sp.length ? `Intervenants : ${sp.join(' ; ')}` : ''].filter(Boolean).join('\n'),
        when: [frDate(s.day_date), s.start_time ? String(s.start_time).slice(0, 5) : ''].filter(Boolean).join(' '),
      });
    }
  }

  if (noveltyIds.length > 0) {
    const [nRes, eRes] = await Promise.all([
      supabase.from('novelties')
        .select('id,event_id,title,summary,type,reason_1,exhibitors!novelties_exhibitor_id_fkey(name)').in('id', noveltyIds),
      supabase.from('novelty_enrichment').select('novelty_id,summary,promise,problems').in('novelty_id', noveltyIds),
    ]);
    if (nRes.error) throw new Error(nRes.error.message);
    if (eRes.error) throw new Error(eRes.error.message);
    const enr = new Map(((eRes.data ?? []) as Record<string, unknown>[]).map((r) => [r.novelty_id as string, r]));
    for (const n of (nRes.data ?? []) as Record<string, unknown>[]) {
      const e = enr.get(n.id as string) as unknown as { summary: string | null; promise: string | null; problems: string[] | null } | undefined;
      const ex = n.exhibitors as { name?: string } | null;
      items.set(`novelty:${n.id}`, {
        key: `novelty:${n.id}`, type: 'novelty', id: n.id as string, event_id: n.event_id as string,
        title: clean(n.title as string, 200),
        summary: clean(e?.summary || (n.summary as string), 300),
        promise: clean(e?.promise, 200),
        problems: (e?.problems ?? []).slice(0, 3),
        extra: [ex?.name ? `Entreprise : ${ex.name}` : '',
                clean(n.reason_1 as string, 300) ? `Argument : ${clean(n.reason_1 as string, 300)}` : '']
          .filter(Boolean).join('\n'),
        when: '',
      });
    }
  }
  return items;
}

function reviewPrompt(
  p: Profile, refs: Refs, list: { idx: number; item: Item; salon: string; date: string }[], recent: Recent[],
): string {
  const blocks = list.map(({ idx, item, salon, date }) => [
    `[${idx}] ${item.type === 'session' ? 'Conférence' : 'Nouveauté'} · ${salon} (${date})`,
    `Titre : ${item.title}`,
    item.promise ? `Ce que le participant en retire : ${item.promise}` : '',
    item.summary ? `Résumé : ${item.summary}` : '',
    item.problems.length ? `Questions traitées : ${item.problems.join(' ; ')}` : '',
    item.extra,
  ].filter(Boolean).join('\n')).join('\n\n');

  const retours = recent.filter((r) => r.title).map(recentLine);
  const retoursBlock = retours.length ? `
SES DERNIERS RETOURS (du plus récent au plus ancien)
${retours.join('\n')}
Ces retours précisent ses goûts, sans en créer de nouveaux.
- Un élément qu'il a ajouté confirme l'angle précis qui le relie à son métier (par exemple un composant qu'il fabrique, un client qu'il vise). Monte ta note seulement pour les éléments qui partagent ce même angle, jamais pour tout ce qui touche au même marché ou au même salon.
- Un élément qu'il a refusé : baisse ta note pour les éléments vraiment proches, refusés pour la même raison.
- Un retour ne dit rien des éléments sans rapport, et le barème ci-dessous reste la règle.
` : '';

  return `Tu es l'assistant d'un professionnel. Tu juges si chaque conférence ou Nouveauté d'exposant ci-dessous vaut le déplacement pour lui, sur un salon professionnel.

PROFIL
${profileText(p, refs)}
${retoursBlock}
ÉLÉMENTS À JUGER
${blocks}

BARÈME (score de 0 à 100)
- 90 à 100 : répond directement à l'un de ses centres d'intérêt, dans son secteur ou pour son métier. Il regretterait de le manquer.
- 70 à 89 : clairement utile pour lui, lien évident avec son activité et ses intérêts.
- 40 à 69 : lien indirect ou sujet trop général pour lui.
- 0 à 39 : sans rapport avec lui.
Une conférence générique (IA, RSE, management, cybersécurité…) qui ne parle ni de son secteur ni de son métier : 60 au maximum.
Une Nouveauté vaut surtout s'il peut l'utiliser, l'acheter ou la proposer dans son activité.
Une session dont on ne sait pas concrètement ce qu'on y apprendra, verra ou pratiquera, ou qui reste culturelle ou grand public : 50 au maximum.

RAISON
Pour chaque élément, une phrase de 160 caractères maximum, adressée à lui avec « vous », qui dit pourquoi c'est utile pour lui. Elle s'appuie uniquement sur le profil et sur le contenu de l'élément : aucun fait inventé, en français correct avec tous les accents, pas de tiret cadratin, pas de superlatif, ne mentionne ni le score ni la façon dont l'élément a été trouvé.

RÉPONSE
Uniquement un objet JSON, sans texte autour, avec une entrée par élément :
{"evaluations": [{"i": 1, "score": 0, "raison": "..."}]}`;
}

async function runMatch(
  supabase: SupabaseClient, anthropicKey: string, p: Profile, refs: Refs, daysFrom: number, daysTo: number,
  adj: Adjustments, maxReviewed: number,
) {
  const cRes = await supabase.rpc('assistant_candidates', {
    p_profile_id: p.id, p_k: 25, p_min_similarity: 0.30, p_days_from: daysFrom, p_days_to: daysTo,
  });
  if (cRes.error) throw new Error(`Présélection : ${cRes.error.message}`);
  // Présélection vide possible (profil très spécialisé, période creuse) : on écrit alors un résultat vide.
  const cands = (cRes.data ?? []) as Candidate[];

  // Un élément peut venir de plusieurs pistes : on garde la meilleure ligne (passe d'abord, puis similarité).
  const best = new Map<string, Candidate>();
  for (const c of cands) {
    const k = `${c.item_type}:${c.item_id}`;
    const cur = best.get(k);
    if (!cur || (c.passes && !cur.passes) || (c.passes === cur.passes && c.similarity > cur.similarity)) {
      best.set(k, c);
    }
  }
  const passing = [...best.values()].filter((c) => c.passes).sort((a, b) => b.similarity - a.similarity);

  // Une pépite que l'utilisateur a ajoutée à son agenda (ou pour laquelle il s'est inscrit ou a demandé un
  // rendez-vous) reste une pépite : elle n'est pas relue et garde sa note et sa raison d'origine.
  type Prev = { item_type: 'session' | 'novelty'; item_id: string; piste_id: string | null; event_id: string;
    similarity: number | null; sector_match: boolean; role_match: boolean; theme_match: boolean;
    score: number | null; reason: string | null; status: string; model: string | null; reviewed_at: string | null };
  const likedRes = await supabase.from('assistant_feedback').select('item_type,item_id')
    .eq('profile_id', p.id).in('signal', ['agenda', 'inscription', 'rdv']).is('undone_at', null);
  if (likedRes.error) throw new Error(likedRes.error.message);
  const likedKeys = new Set(((likedRes.data ?? []) as { item_type: string; item_id: string }[])
    .map((x) => `${x.item_type}:${x.item_id}`));
  const prevByKey = new Map<string, Prev>();
  if (likedKeys.size) {
    const ids = [...likedKeys].map((k) => k.split(':')[1]);
    const prevRes = await supabase.from('assistant_matches')
      .select('item_type,item_id,piste_id,event_id,similarity,sector_match,role_match,theme_match,score,reason,status,model,reviewed_at')
      .eq('profile_id', p.id).in('item_id', ids);
    if (prevRes.error) throw new Error(prevRes.error.message);
    for (const x of (prevRes.data ?? []) as Prev[]) prevByKey.set(`${x.item_type}:${x.item_id}`, x);
  }
  const excludedEvents = new Set(adj.excluded_event_ids);
  const failing = [...best.values()].filter((c) => !c.passes && !likedKeys.has(`${c.item_type}:${c.item_id}`));

  const items = await loadItems(
    supabase,
    passing.filter((c) => c.item_type === 'session').map((c) => c.item_id),
    passing.filter((c) => c.item_type === 'novelty').map((c) => c.item_id),
  );

  // Une pépite refusée ne revient pas sous une autre séance (rediffusion du même titre dans le même salon).
  const refusedTitle = new Set<string>();
  const exSess = adj.excluded_items.filter((x) => x.item_type === 'session').map((x) => x.item_id);
  const exNov = adj.excluded_items.filter((x) => x.item_type === 'novelty').map((x) => x.item_id);
  if (exSess.length) {
    const r = await supabase.from('event_program_sessions').select('event_id,title').in('id', exSess);
    if (r.error) throw new Error(r.error.message);
    for (const x of (r.data ?? []) as { event_id: string; title: string }[]) {
      refusedTitle.add(`${x.event_id}|session|${titleKey(clean(x.title, 200))}`);
    }
  }
  if (exNov.length) {
    const r = await supabase.from('novelties').select('event_id,title').in('id', exNov);
    if (r.error) throw new Error(r.error.message);
    for (const x of (r.data ?? []) as { event_id: string; title: string }[]) {
      refusedTitle.add(`${x.event_id}|novelty|${titleKey(clean(x.title, 200))}`);
    }
  }

  // Une conférence rejouée à plusieurs horaires dans un même salon = une seule pépite.
  const seenTitle = new Set<string>();
  const toReview: Candidate[] = [];
  let duplicates = 0;
  let refusedReplays = 0;
  for (const c of passing) {
    const it = items.get(`${c.item_type}:${c.item_id}`);
    if (!it) continue;
    const tk = `${c.event_id}|${c.item_type}|${titleKey(it.title)}`;
    if (likedKeys.has(`${c.item_type}:${c.item_id}`)) { seenTitle.add(tk); continue; }
    if (refusedTitle.has(tk)) { refusedReplays++; continue; }
    if (seenTitle.has(tk)) { duplicates++; continue; }
    seenTitle.add(tk);
    toReview.push(c);
    if (toReview.length >= maxReviewed) break;
  }

  const eventIds = [...new Set(toReview.map((c) => c.event_id))];
  const evRes = eventIds.length
    ? await supabase.from('events').select('id,nom_event,date_debut,date_fin').in('id', eventIds)
    : { data: [], error: null };
  if (evRes.error) throw new Error(evRes.error.message);
  const events = new Map(((evRes.data ?? []) as Record<string, string | null>[]).map((e) => [e.id as string, e]));

  // Relecture IA par paquets
  const reviews = new Map<string, { score: number; reason: string; model: string }>();
  const chunks: Candidate[][] = [];
  for (let i = 0; i < toReview.length; i += REVIEW_CHUNK) chunks.push(toReview.slice(i, i + REVIEW_CHUNK));
  let reviewErrors = 0;
  let ci = 0;
  async function worker() {
    while (ci < chunks.length) {
      const chunk = chunks[ci++];
      const list = chunk.map((c, j) => {
        const ev = events.get(c.event_id);
        return {
          idx: j + 1, item: items.get(`${c.item_type}:${c.item_id}`)!,
          salon: (ev?.nom_event as string) || 'salon', date: frDate(ev?.date_debut as string),
        };
      });
      const res = await callAnthropic({
        apiKey: anthropicKey, model: MODEL, userMessage: reviewPrompt(p, refs, list, adj.recent),
        maxTokens: 3000, caller: 'assistant-pepites:review',
      });
      const out = res.ok && res.text ? parseJson(res.text) : null;
      const evals = Array.isArray(out?.evaluations) ? (out!.evaluations as Record<string, unknown>[]) : null;
      if (!evals) { reviewErrors++; continue; }
      for (const e of evals) {
        const j = Number(e.i);
        const score = Math.round(Number(e.score));
        if (!Number.isInteger(j) || j < 1 || j > list.length || !Number.isFinite(score)) continue;
        const reason = clip(clean(typeof e.raison === 'string' ? e.raison.replace(/—/g, ',') : '', 300), 200);
        reviews.set(list[j - 1].item.key, { score: Math.max(0, Math.min(100, score)), reason, model: res.model });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(REVIEW_CONCURRENCY, chunks.length) }, () => worker()));
  if (chunks.length > 0 && reviewErrors === chunks.length) throw new Error('Relecture IA : tous les appels ont échoué');

  // Écriture des pépites (on repart de zéro pour ce profil)
  const now = new Date().toISOString();
  const weak = new Set(adj.weak_piste_ids);
  const rows = [
    ...toReview.map((c) => {
      const r = reviews.get(`${c.item_type}:${c.item_id}`);
      const threshold = weak.has(c.piste_id) ? WEAK_RETAIN_SCORE : RETAIN_SCORE;
      return {
        profile_id: p.id, piste_id: c.piste_id, item_type: c.item_type, item_id: c.item_id, event_id: c.event_id,
        similarity: c.similarity, sector_match: c.sector_match, role_match: c.role_match, theme_match: c.theme_match,
        score: r ? r.score : null, reason: r ? r.reason : null,
        status: r ? (r.score >= threshold ? 'retained' : 'rejected') : 'candidate',
        model: r ? r.model : null, reviewed_at: r ? now : null,
      };
    }),
    // pépites aimées : conservées telles quelles (sauf salon refusé depuis)
    ...[...likedKeys].flatMap((k) => {
      const c = best.get(k);
      const prev = prevByKey.get(k);
      const eventId = c?.event_id ?? prev?.event_id;
      if (!eventId || excludedEvents.has(eventId)) return [];
      const keep = prev && prev.status === 'retained';
      const [itemType, itemId] = k.split(':') as ['session' | 'novelty', string];
      return [{
        profile_id: p.id, piste_id: c?.piste_id ?? prev?.piste_id ?? null, item_type: itemType, item_id: itemId,
        event_id: eventId, similarity: c?.similarity ?? prev?.similarity ?? null,
        sector_match: c?.sector_match ?? prev?.sector_match ?? false,
        role_match: c?.role_match ?? prev?.role_match ?? false,
        theme_match: c?.theme_match ?? prev?.theme_match ?? false,
        score: keep ? prev!.score : null, reason: keep ? prev!.reason : null, status: 'retained',
        model: keep ? prev!.model : null, reviewed_at: keep ? prev!.reviewed_at : null,
      }];
    }),
    // éléments écartés par le croisement : gardés pour le diagnostic, jamais montrés
    ...failing.map((c) => ({
      profile_id: p.id, piste_id: c.piste_id, item_type: c.item_type, item_id: c.item_id, event_id: c.event_id,
      similarity: c.similarity, sector_match: c.sector_match, role_match: c.role_match, theme_match: c.theme_match,
      score: null, reason: null, status: 'rejected', model: null, reviewed_at: null,
    })),
  ];
  const del = await supabase.from('assistant_matches').delete().eq('profile_id', p.id);
  if (del.error) throw new Error(del.error.message);
  const inserted: { id: string; item_type: string; item_id: string; event_id: string; score: number | null;
    status: string; sector_match: boolean }[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const ins = await supabase.from('assistant_matches').insert(rows.slice(i, i + 200))
      .select('id,item_type,item_id,event_id,score,status,sector_match');
    if (ins.error) throw new Error(ins.error.message);
    inserted.push(...(ins.data ?? []));
  }

  // Regroupement par salon
  const byEvent = new Map<string, typeof inserted>();
  for (const m of inserted.filter((x) => x.status === 'retained')) {
    const list = byEvent.get(m.event_id) ?? [];
    list.push(m);
    byEvent.set(m.event_id, list);
  }
  const suggestions = [...byEvent.entries()]
    .map(([eventId, list]) => {
      list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const top = list[0];
      const ok = list.length >= 2 || ((top.score ?? 0) >= STRONG_SCORE && top.sector_match);
      return ok ? {
        profile_id: p.id, event_id: eventId, match_ids: list.map((m) => m.id),
        pepite_count: list.length, best_score: top.score, computed_at: now,
      } : null;
    })
    .filter((s): s is NonNullable<typeof s> => !!s);

  // Les salons qui ne sont plus suggérés et n'ont encore rien déclenché disparaissent.
  // (Les salons refusés par « Je n'irai pas » n'arrivent jamais ici : la présélection les exclut.)
  const keep = suggestions.map((s) => s.event_id);
  let delSugg = supabase.from('assistant_suggestions').delete().eq('profile_id', p.id).eq('status', 'pending');
  if (keep.length) delSugg = delSugg.not('event_id', 'in', `(${keep.join(',')})`);
  const ds = await delSugg;
  if (ds.error) throw new Error(ds.error.message);
  if (suggestions.length) {
    const up = await supabase.from('assistant_suggestions').upsert(suggestions, { onConflict: 'profile_id,event_id' });
    if (up.error) throw new Error(up.error.message);
  }

  return {
    candidats: best.size,
    passent_le_croisement: passing.length,
    doublons_de_titre: duplicates,
    rediffusions_refusees: refusedReplays,
    pepites_aimees_conservees: likedKeys.size,
    relus: reviews.size,
    retenus: inserted.filter((x) => x.status === 'retained').length,
    erreurs_relecture: reviewErrors,
    salons_suggeres: suggestions
      .sort((a, b) => (b.best_score ?? 0) - (a.best_score ?? 0))
      .map((s) => ({ salon: events.get(s.event_id)?.nom_event, pepites: s.pepite_count, meilleur_score: s.best_score })),
  };
}

// ---------------------------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anthropicKey || !anonKey) {
    return json({ error: 'Missing required secrets' }, 500);
  }

  // Auth : service_role, admin, ou l'utilisateur lui-même (session anonyme comprise) pour SON assistant
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice('Bearer '.length);
  const supabase = createClient(supabaseUrl, serviceKey);
  let caller: 'service' | 'admin' | 'owner' = 'service';
  let callerId = '';
  let callerAnonymous = false;
  if (token !== serviceKey) {
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const claims = claimsData?.claims as Record<string, unknown> | undefined;
    if (claimsError || typeof claims?.sub !== 'string') return json({ error: 'Unauthorized' }, 401);
    callerId = claims.sub;
    callerAnonymous = claims.is_anonymous === true;
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: callerId,
      _role: 'admin',
    });
    if (roleError) return json({ error: 'Unauthorized' }, 401);
    caller = isAdmin === true && !callerAnonymous ? 'admin' : 'owner';
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  let profileId = typeof body.profile_id === 'string' ? body.profile_id : '';
  let step = body.step === 'pistes' || body.step === 'match' || body.step === 'adapt' ? body.step : 'all';
  let daysFrom = typeof body.days_from === 'number' ? Math.max(0, Math.min(365, body.days_from)) : 0;
  let daysTo = typeof body.days_to === 'number' ? Math.max(daysFrom, Math.min(365, body.days_to)) : 60;
  const preview = body.preview === true || callerAnonymous;
  if (caller === 'owner') {
    // l'utilisateur ne règle ni la fenêtre ni l'étape « adapt » (réservée à la tâche planifiée)
    if (step === 'adapt') step = 'match';
    daysFrom = 0;
    daysTo = 60;
  }
  if (profileId && !/^[0-9a-f-]{36}$/i.test(profileId)) return json({ error: 'profile_id invalide' }, 400);
  if (!profileId && caller !== 'owner') return json({ error: 'profile_id manquant' }, 400);

  try {
    let q = supabase.from('assistant_profiles')
      .select('id,user_id,label,company_name,company_description,sector_ids,sub_sector_ids,role_code,role_codes,role_other,interests,goals');
    q = profileId ? q.eq('id', profileId) : q.eq('user_id', callerId);
    const pRes = await q.maybeSingle();
    if (pRes.error) return json({ error: pRes.error.message }, 500);
    if (!pRes.data) return json({ error: 'Assistant introuvable' }, 404);
    const p = pRes.data as Profile;
    profileId = p.id;
    if (caller === 'owner' && p.user_id !== callerId) return json({ error: 'Accès refusé' }, 403);

    // Quota par 24 h (le coût de l'IA) : seulement pour l'utilisateur lui-même
    if (caller === 'owner') {
      const quota = await supabase.rpc('assistant_engine_run_allowed', {
        p_user_id: callerId, p_is_anonymous: callerAnonymous,
        p_mode: step === 'pistes' ? 'pistes' : `engine_${step}`, p_profile_id: p.id,
      });
      if (quota.error) return json({ error: quota.error.message }, 500);
      if ((quota.data as { allowed?: boolean } | null)?.allowed !== true) {
        return json({
          error: callerAnonymous
            ? 'Vous avez atteint la limite de recherches pour aujourd\'hui. Créez votre compte pour continuer.'
            : 'Vous avez atteint la limite de recherches pour aujourd\'hui. Réessayez demain.',
          code: 'quota',
        }, 429);
      }
    }

    const refs = await loadRefs(supabase);
    if (refs.themes.length === 0 || refs.roles.length === 0 || refs.subs.length === 0) {
      return json({ error: 'Référentiels vides : arrêt sans écriture' }, 500);
    }

    const startedAt = new Date().toISOString();
    const result: Record<string, unknown> = { profile_id: p.id, label: p.label, model: MODEL, step, preview };
    if (step === 'all' || step === 'pistes') result.pistes = await buildPistes(supabase, anthropicKey, p, refs);

    let adj: Adjustments = EMPTY_ADJ;
    if (step !== 'pistes') adj = await loadAdjustments(supabase, p.id);
    if (step === 'adapt') {
      result.pistes_remplacees = await replacePistes(supabase, anthropicKey, p, refs, adj);
      const tune = await supabase.rpc('assistant_tune_pistes', { p_profile_id: p.id });
      if (tune.error) throw new Error(`Ajustement des pistes : ${tune.error.message}`);
      result.pistes_ajustees = tune.data;
      adj = await loadAdjustments(supabase, p.id);
    }
    if (step !== 'pistes') {
      // pistes modifiées par l'utilisateur : vecteur à recalculer avant la présélection
      const missing = await supabase.from('assistant_pistes').select('id', { count: 'exact', head: true })
        .eq('profile_id', p.id).eq('active', true).is('embedding', null);
      if (missing.error) throw new Error(missing.error.message);
      if ((missing.count ?? 0) > 0) await embedPistes(supabase, p.id);
    }
    try {
      result.libelles_courts = await fillShortLabels(supabase, anthropicKey, p.id);
    } catch (e) {
      console.error('[assistant-pepites] libellés courts', (e as Error).message);
    }
    if (step !== 'pistes') {
      result.retours = {
        nombre: adj.feedback_count,
        elements_exclus: adj.excluded_items.length,
        salons_exclus: adj.excluded_event_ids.length,
        series_exclues: adj.excluded_series_ids.length,
        secteurs_bloques: adj.blocked_sector_ids.length,
        pistes_affaiblies: adj.weak_piste_ids.length,
        secteur_exige: adj.require_sector,
        proposer_distance: adj.propose_distance,
      };
      result.fenetre = { days_from: daysFrom, days_to: daysTo };
      result.moteur = await runMatch(supabase, anthropicKey, p, refs, daysFrom, daysTo, adj,
        preview ? PREVIEW_MAX_REVIEWED : MAX_REVIEWED);
      const mark = await supabase.from('assistant_profiles')
        .update({ refreshed_at: startedAt, refresh_attempts: 0 }).eq('id', p.id);
      if (mark.error) console.error('[assistant-pepites] refreshed_at', mark.error.message);
      // Après un aperçu, un compte reçoit la recherche complète par la tâche planifiée (quelques minutes).
      // Une session anonyme l'aura au rattachement de son assistant à un compte.
      if (preview && caller === 'owner' && !callerAnonymous) {
        const full = await supabase.from('assistant_profiles')
          .update({ refresh_requested_at: new Date().toISOString(), refresh_attempts: 0 }).eq('id', p.id);
        if (full.error) console.error('[assistant-pepites] refresh_requested_at', full.error.message);
      }
    }
    if (caller === 'owner') {
      // l'utilisateur relit ensuite son fil (assistant_my_feed) : réponse courte, sans diagnostic
      const m = result.moteur as { retenus?: number; salons_suggeres?: unknown[] } | undefined;
      return json({
        ok: true, profile_id: p.id, step, preview,
        pistes: result.pistes ?? null,
        pepites: m?.retenus ?? null,
        salons: m?.salons_suggeres?.length ?? null,
      });
    }
    return json(result);
  } catch (e) {
    console.error('[assistant-pepites]', profileId, (e as Error).message);
    return json({ error: (e as Error).message, profile_id: profileId }, 500);
  }
});
