// supabase/functions/assistant-onboarding/index.ts
// Assistant « Pépites », lot 3 : les aides de l'onboarding (/agenda/creer), avec le modèle rapide.
// Appelée par le site avec la session de la personne (une session anonyme suffit).
// Quota : 30 appels par 24 h et par personne (assistant_engine_run_allowed, mode « interests »).
//
// Corps : { "action": "interests", "company_name": "...", "company_description": "...",
//           "sub_sector_ids": ["..."], "role_codes": ["..."], "role_other": "...",
//           "exclude": ["..."], "selected": ["..."] }
//   (role_code seul reste accepté.) exclude : sujets déjà affichés, à ne pas reproposer ;
//   selected : sujets déjà choisis. Avec exclude non vide, l'IA propose d'AUTRES sujets, proches de ceux
//   choisis et plus précis (bouton « Proposer d'autres sujets » de l'écran 3).
// Réponse : { "suggestions": [{ "label": "...", "generic": false, "theme_code": null, "precisions": [] }] }
//   6 à 8 centres d'intérêt proposés à l'écran 3. Un thème générique (IA, RSE, export…) porte 3 à 4
//   précisions prêtes à l'emploi (« IA pour concevoir les machines »…) : un clic remplace le libellé.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { callAnthropic, getAnthropicModelFast } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = getAnthropicModelFast();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clean(t: unknown, max: number): string {
  return (typeof t === 'string' ? t : '').replace(/—/g, ',').replace(/\s+/g, ' ').trim().slice(0, max);
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

type Suggestion = { label: string; generic: boolean; theme_code: string | null; precisions: string[] };

function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const t = clean(x, maxLen);
    if (t.length >= 2 && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

function interestsPrompt(
  company: string, description: string, sectors: string[], role: string,
  themes: { code: string; label: string }[],
  exclude: string[] = [], selected: string[] = [],
): string {
  const more = exclude.length > 0;
  const task = more
    ? `TA TÂCHE
La personne a déjà vu des propositions et veut en voir d'AUTRES, pour affiner son assistant.
${selected.length ? `Elle a choisi :\n${selected.map((t) => `- ${t}`).join('\n')}\n` : ''}Déjà proposés (ne JAMAIS les reproposer, ni les reformuler) :
${exclude.map((t) => `- ${t}`).join('\n')}
Propose 6 nouveaux centres d'intérêt. ${selected.length ? 'Au moins 4 doivent être proches de ses choix mais plus précis ou complémentaires (un sous-sujet, une application concrète, un enjeu voisin).' : 'Explore des angles différents de son métier.'}`
    : `TA TÂCHE
Propose 6 à 8 centres d'intérêt professionnels qu'une personne de ce rôle, dans cette entreprise, a probablement en ce moment. Elle cochera ceux qui lui parlent.`;
  return `Tu aides un professionnel à créer son assistant salons, qui lui signalera les conférences et les Nouveautés d'exposants utiles pour lui sur les salons professionnels.

LA PERSONNE
Entreprise : ${company || 'non précisée'}${description ? ` (${description})` : ''}
Secteurs de l'entreprise : ${sectors.join(', ') || 'non précisés'}
Rôle : ${role || 'non précisé'}

THÈMES TRANSVERSAUX (codes autorisés)
${themes.map((t) => `${t.code} : ${t.label}`).join('\n')}

${task}

RÈGLES
1. label : 2 à 6 mots, en français, concret, sans tiret cadratin. Exemple : « Maintenance prédictive », « Réglementation des emballages ».
2. Au moins 4 propositions propres à son métier ou à son secteur (generique : false, theme : null).
3. Au plus 2 propositions peuvent être des thèmes transversaux (generique : true) : theme est alors un code de la liste, et precisions donne 3 ou 4 façons concrètes de l'appliquer à son activité, chacune de 3 à 8 mots (exemple pour l'IA chez un fabricant de machines : « IA pour concevoir les machines », « IA en production », « IA pour le service client »).
4. Pas de doublons, pas de sujet sans lien avec l'entreprise ou le rôle. N'invente rien sur l'entreprise.

RÉPONSE
Uniquement un objet JSON, sans texte autour :
{"suggestions": [{"label": "...", "generique": false, "theme": null, "precisions": []}]}`;
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

  // Une session (anonyme ou non) est requise : c'est elle qui porte le quota
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice('Bearer '.length);
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  if (claimsError || typeof claims?.sub !== 'string') return json({ error: 'Unauthorized' }, 401);
  const userId = claims.sub;
  const isAnonymous = claims.is_anonymous === true;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* corps vide */ }
  if (body.action !== 'interests') return json({ error: 'action inconnue' }, 400);

  const supabase = createClient(supabaseUrl, serviceKey);
  try {
    const quota = await supabase.rpc('assistant_engine_run_allowed', {
      p_user_id: userId, p_is_anonymous: isAnonymous, p_mode: 'interests', p_profile_id: null,
    });
    if (quota.error) return json({ error: quota.error.message }, 500);
    if ((quota.data as { allowed?: boolean } | null)?.allowed !== true) {
      return json({ error: 'Trop de demandes aujourd\'hui. Saisissez vos centres d\'intérêt librement.', code: 'quota' }, 429);
    }

    const subIds = Array.isArray(body.sub_sector_ids)
      ? body.sub_sector_ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 10)
      : [];
    const roleCodes = strList(body.role_codes, 4, 40);
    const single = clean(body.role_code, 40);
    if (roleCodes.length === 0 && single) roleCodes.push(single);
    const roleOther = clean(body.role_other, 80);
    const exclude = strList(body.exclude, 60, 90);
    const selected = strList(body.selected, 12, 90);
    const [themesRes, roleRes, subsRes] = await Promise.all([
      supabase.from('assistant_themes').select('code,label').order('position'),
      roleCodes.length
        ? supabase.from('assistant_roles').select('code,label').in('code', roleCodes)
        : Promise.resolve({ data: [], error: null }),
      subIds.length
        ? supabase.from('sub_sectors').select('name,sectors(name)').in('id', subIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (themesRes.error) throw new Error(themesRes.error.message);
    const themes = (themesRes.data ?? []) as { code: string; label: string }[];
    const roleLabels = roleCodes
      .map((c) => ((roleRes.data ?? []) as { code: string; label: string }[]).find((r) => r.code === c)?.label)
      .filter((l): l is string => !!l);
    if (roleOther) roleLabels.push(roleOther);
    const role = roleLabels.join(', ');
    const sectors: string[] = [];
    for (const s of (subsRes.data ?? []) as { name: string; sectors: { name: string } | null }[]) {
      if (s.sectors?.name && !sectors.includes(s.sectors.name)) sectors.push(s.sectors.name);
      if (!sectors.includes(s.name)) sectors.push(s.name);
    }

    const res = await callAnthropic({
      apiKey: anthropicKey, model: MODEL, maxTokens: 1200, caller: 'assistant-onboarding:interests',
      userMessage: interestsPrompt(
        clean(body.company_name, 160), clean(body.company_description, 500), sectors, role, themes,
        exclude, selected,
      ),
    });
    if (!res.ok || !res.text) throw new Error(`Claude : ${res.error || 'réponse vide'}`);
    const out = parseJson(res.text);
    const raw = Array.isArray(out?.suggestions) ? (out!.suggestions as Record<string, unknown>[]) : [];

    const themeCodes = new Set(themes.map((t) => t.code));
    const seen = new Set<string>(exclude.map((t) => t.toLowerCase()));
    const suggestions: Suggestion[] = [];
    for (const x of raw) {
      const label = clean(x.label, 80);
      const key = label.toLowerCase();
      if (label.length < 3 || seen.has(key)) continue;
      seen.add(key);
      const theme = typeof x.theme === 'string' && themeCodes.has(x.theme) ? x.theme : null;
      const generic = x.generique === true && theme !== null;
      const precisions = generic && Array.isArray(x.precisions)
        ? x.precisions.map((p) => clean(p, 90)).filter((p) => p.length >= 3).slice(0, 4)
        : [];
      suggestions.push({ label, generic: generic && precisions.length > 0, theme_code: theme, precisions });
      if (suggestions.length >= 8) break;
    }
    if (suggestions.length === 0) throw new Error('Claude : aucune proposition exploitable');
    return json({ suggestions, model: res.model });
  } catch (e) {
    console.error('[assistant-onboarding]', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
