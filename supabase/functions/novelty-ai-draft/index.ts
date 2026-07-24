import { createClient } from 'npm:@supabase/supabase-js@2';
import { callAnthropic, getAnthropicModelStrong } from '../_shared/anthropic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = getAnthropicModelStrong();
const MAX_TEXTE = 20_000;

const ANCRE_FAMILLES = new Set([
  'designation',
  'exclusivite',
  'experience',
  'rendez_vous',
  'preuve',
  'contrepartie',
  'tiers',
]);

const NOVELTY_TYPES = new Set([
  'Launch',
  'Update',
  'Demo',
  'Special_Offer',
  'Partnership',
  'Innovation',
]);

const SYSTEM_ANALYSER = `Tu évalues l'annonce qu'un exposant s'apprête à publier sur Lotexpo avant un salon professionnel. Tu ne rédiges rien, tu diagnostiques.

Une Nouveauté n'est PAS forcément un lancement de produit. Une conférence, une démonstration, un atelier, un partenariat, une offre ou une expérience sur stand sont des Nouveautés parfaitement légitimes. La majorité des exposants ne vient pas annoncer un produit neuf. Ne pénalise jamais une annonce parce qu'elle ne parle pas d'un produit.

La seule question est : y a-t-il une raison de se déplacer que le site web de l'entreprise ne donne pas déjà ?

Cherche des ANCRES DE SPÉCIFICITÉ. Sept familles, UNE SEULE suffit :
1. designation — un nom de produit, une référence, un modèle, une gamme, une version
2. exclusivite — première présentation, avant-première, primeur, lancement
3. experience — quelque chose à voir, toucher, tester, essayer, goûter, manipuler sur le stand
4. rendez_vous — conférence, atelier, démonstration à horaire, table ronde, masterclass, dégustation
5. preuve — un chiffre, un résultat client, une certification, un brevet, une norme, un label
6. contrepartie — une offre, une condition ou un tarif spécifiques au salon
7. tiers — un partenaire, un client, une institution nommés

Repère aussi les FORMULATIONS CREUSES, celles que 90 % des exposants emploient faute de mieux : « au plaisir de vous rencontrer », « venez échanger sur vos problématiques », « n'hésitez pas à passer nous voir », « toute l'équipe vous attend », « retrouvez-nous sur le stand ».

Réponds UNIQUEMENT par un objet JSON valide, sans préambule ni backticks :
{
  "ancres": [{"famille": "<une des sept>", "presente": true, "extrait": "<les mots exacts du texte, jamais reformulés>"}],
  "formulations_creuses": ["<extrait exact>"],
  "type_suggere": "Launch|Update|Demo|Special_Offer|Partnership|Innovation",
  "suffisant": true,
  "question": null
}

Règles :
- N'inscris une ancre que si tu peux citer les mots EXACTS du texte qui la portent. Pas d'extrait, pas d'ancre.
- "suffisant" est vrai dès qu'au moins une ancre est présente.
- Si aucune ancre n'est trouvée, "suffisant" est faux et "question" contient UNE seule question, courte, adressée au manque précis, adaptée au type déclaré ou déduit :
  Demo → que verra concrètement le visiteur, et à quel moment ?
  Launch → quelle est la désignation de ce qui est lancé, et qu'est-ce qui change pour l'utilisateur ?
  Update → qu'est-ce qui évolue par rapport à la version précédente, et pour qui cela compte-t-il ?
  Partnership → avec qui, et qu'est-ce que cela permet de faire que vous ne pouviez pas faire seul ?
  Special_Offer → quelle est la condition exacte, et jusqu'à quand ?
  Innovation → qu'est-ce que le visiteur pourra voir ou comprendre sur le stand ?
- La question s'adresse à un professionnel, d'égal à égal. Jamais de reproche, jamais de note, jamais de score.
- Si "suffisant" est vrai, "question" vaut null.`;

const SYSTEM_GENERER = `Tu rédiges une Nouveauté pour Lotexpo, l'annonce qu'un exposant publie avant un salon professionnel. Elle doit donner à un acheteur une raison de s'arrêter sur ce stand.

RÈGLE ABSOLUE : tu n'ajoutes AUCUN fait absent du texte fourni. Pas un nom de produit, pas un chiffre, pas une date, pas une certification, pas un client, pas un superlatif vérifiable. Tu reformules et tu structures ce que l'exposant a écrit, rien d'autre. Le contexte Lotexpo fourni sert à choisir le ton et le public visé, jamais à inventer du contenu.

Ce que tu changes, c'est l'ordre et l'angle. La plupart des exposants commencent par ce que fait leur produit. Commence par ce que le visiteur y gagne, puis dis ce que c'est, puis comment le voir sur le salon.

Produis TROIS angles différents. Pas trois formulations de la même chose : trois entrées réellement distinctes dans la matière, par exemple le bénéfice acheteur, la preuve concrète, ou l'expérience sur le stand. Si la matière ne permet pas trois angles honnêtes, n'en produis que deux et n'invente pas le troisième.

Contraintes de format :
- title : 60 à 90 caractères, sans nom de salon, sans date, sans point final.
- reason_1 : 200 à 500 caractères. C'est la raison principale de venir.
- reason_2 et reason_3 : 100 à 300 caractères chacune, ou null si la matière ne les porte pas.
- summary : une seule phrase, 100 à 160 caractères.
- audience_tags : 2 à 5 profils d'acheteurs, tirés des profils visiteurs du contexte quand ils existent.
- type : une valeur EXACTE parmi Launch, Update, Demo, Special_Offer, Partnership, Innovation.

Style : français professionnel, factuel, concret. Pas de superlatif creux, pas de « solution innovante », pas de « leader ». Aucun tiret cadratin. Pas d'emoji.

Réponds UNIQUEMENT par un objet JSON valide, sans préambule ni backticks :
{
  "angles": [
    {"id":"a1","libelle":"<2 à 4 mots décrivant l'angle>","title":"…","type":"…",
     "reason_1":"…","reason_2":"…","reason_3":null,"summary":"…","audience_tags":["…"]}
  ],
  "faits_utilises": ["<chaque fait repris du texte de l'exposant>"]
}

"faits_utilises" doit permettre de vérifier que tu n'as rien ajouté. Si un élément de ta rédaction n'y figure pas, c'est qu'il est inventé : retire-le.`;

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function stripBackticks(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return t.trim();
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(stripBackticks(raw));
  } catch {
    // Try to grab the first {...} block.
    const s = stripBackticks(raw);
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(s.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anthropicKey || !anonKey) {
    return jsonResp({ error: 'Missing required secrets' }, 500);
  }

  // --- Auth : service_role OU utilisateur admin (motif generate-event-accroches) ---
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice('Bearer '.length);
  if (token !== serviceKey) {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResp({ error: 'Unauthorized' }, 401);
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin, error: roleError } = await admin.rpc('has_role', {
      _user_id: claimsData.claims.sub,
      _role: 'admin',
    });
    if (roleError || !isAdmin) {
      return jsonResp({ error: 'Forbidden: admin only' }, 403);
    }
  }

  // --- Validation d'entrée ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: 'invalid_json' }, 400);
  }

  const action = body?.action;
  const exhibitor_id = body?.exhibitor_id;
  const event_id = body?.event_id;
  const texte = typeof body?.texte === 'string' ? body.texte : '';
  const typeInput = body?.type;

  if (action !== 'analyser' && action !== 'generer') {
    return jsonResp({ error: 'action_invalide', details: 'analyser|generer' }, 400);
  }
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof exhibitor_id !== 'string' || !uuidRe.test(exhibitor_id)) {
    return jsonResp({ error: 'exhibitor_id_invalide' }, 400);
  }
  if (typeof event_id !== 'string' || !uuidRe.test(event_id)) {
    return jsonResp({ error: 'event_id_invalide' }, 400);
  }
  const trimmed = texte.trim();
  if (!trimmed) {
    return jsonResp({ error: 'texte_vide' }, 400);
  }
  if (trimmed.length > MAX_TEXTE) {
    return jsonResp({ error: 'texte_trop_long', max: MAX_TEXTE }, 400);
  }
  if (typeInput !== undefined && typeInput !== null && !NOVELTY_TYPES.has(typeInput)) {
    return jsonResp({ error: 'type_invalide' }, 400);
  }

  // --- Contexte via RPC ---
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: ctx, error: ctxError } = await supabase.rpc('get_novelty_ai_context', {
    p_exhibitor_id: exhibitor_id,
    p_event_id: event_id,
  });
  if (ctxError) {
    console.error('[novelty-ai-draft] rpc error', ctxError.message);
    return jsonResp({ error: 'contexte_indisponible', details: ctxError.message }, 500);
  }
  if (ctx && typeof ctx === 'object' && 'erreur' in (ctx as any)) {
    return jsonResp({ error: (ctx as any).erreur }, 404);
  }

  // --- Construction du message utilisateur ---
  const typeLabel = typeInput ? String(typeInput) : 'non précisé';
  const userMessage = [
    '=== CONTEXTE LOTEXPO (JSON) ===',
    JSON.stringify(ctx, null, 2),
    '',
    `=== TYPE DÉCLARÉ PAR L'EXPOSANT ===`,
    typeLabel,
    '',
    `=== TEXTE DE L'EXPOSANT ===`,
    trimmed,
  ].join('\n');

  const system = action === 'analyser' ? SYSTEM_ANALYSER : SYSTEM_GENERER;
  const maxTokens = action === 'analyser' ? 1200 : 3000;

  const res = await callAnthropic({
    apiKey: anthropicKey,
    model: MODEL,
    system,
    userMessage,
    maxTokens,
    caller: `novelty-ai-draft:${action}`,
  });

  if (!res.ok || !res.text) {
    return jsonResp(
      { error: res.errorCode ?? 'anthropic_error', details: res.error ?? null, model: res.model },
      res.status && res.status >= 400 ? res.status : 502,
    );
  }

  const parsed = tryParseJson(res.text);
  if (!parsed || typeof parsed !== 'object') {
    return jsonResp(
      {
        error: 'reponse_non_parsable',
        raw_preview: res.text.slice(0, 300),
        model: res.model,
      },
      502,
    );
  }

  if (action === 'analyser') {
    const p = parsed as any;
    const ancresIn = Array.isArray(p.ancres) ? p.ancres : [];
    const ancres = ancresIn.filter(
      (a: any) =>
        a &&
        typeof a.famille === 'string' &&
        ANCRE_FAMILLES.has(a.famille) &&
        typeof a.extrait === 'string' &&
        a.extrait.trim().length > 0,
    ).map((a: any) => ({
      famille: a.famille,
      presente: a.presente !== false,
      extrait: a.extrait,
    }));

    const formulations_creuses = Array.isArray(p.formulations_creuses)
      ? p.formulations_creuses.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
      : [];

    const type_suggere = NOVELTY_TYPES.has(p.type_suggere)
      ? p.type_suggere
      : (typeInput && NOVELTY_TYPES.has(typeInput) ? typeInput : null);

    const suffisant = ancres.length > 0;
    const question = suffisant ? null : (typeof p.question === 'string' ? p.question : null);

    return jsonResp({
      ancres,
      nb_ancres: ancres.length,
      formulations_creuses,
      type_suggere,
      suffisant,
      question,
      model: res.model,
    });
  }

  // action === 'generer'
  const p = parsed as any;
  const anglesIn = Array.isArray(p.angles) ? p.angles : [];
  const fallbackType = typeInput && NOVELTY_TYPES.has(typeInput) ? typeInput : 'Innovation';
  const angles = anglesIn.map((a: any, i: number) => ({
    id: typeof a?.id === 'string' && a.id ? a.id : `a${i + 1}`,
    libelle: typeof a?.libelle === 'string' ? a.libelle : '',
    title: typeof a?.title === 'string' ? a.title : '',
    type: NOVELTY_TYPES.has(a?.type) ? a.type : fallbackType,
    reason_1: typeof a?.reason_1 === 'string' ? a.reason_1 : '',
    reason_2: typeof a?.reason_2 === 'string' ? a.reason_2 : null,
    reason_3: typeof a?.reason_3 === 'string' ? a.reason_3 : null,
    summary: typeof a?.summary === 'string' ? a.summary : '',
    audience_tags: Array.isArray(a?.audience_tags)
      ? a.audience_tags.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
      : [],
  }));

  const faits_utilises = Array.isArray(p.faits_utilises)
    ? p.faits_utilises.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
    : [];

  return jsonResp({ angles, faits_utilises, model: res.model });
});