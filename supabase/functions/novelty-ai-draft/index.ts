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

Une Nouveauté n'est PAS forcément un lancement de produit. Une conférence, une démonstration, un atelier, un partenariat, une offre, une étude ou une expérience sur stand sont des Nouveautés parfaitement légitimes. La majorité des exposants ne vient pas annoncer un produit neuf. Ne pénalise jamais une annonce parce qu'elle ne parle pas d'un produit.

La seule question est : y a-t-il une raison de se déplacer que le site web de l'entreprise ne donne pas déjà ?

PARTIE 1 — LES ANCRES DE SPÉCIFICITÉ
Sept familles, UNE SEULE suffit :
1. designation — un nom de produit, une référence, un modèle, une gamme, une version
2. exclusivite — première présentation, avant-première, primeur, lancement
3. experience — quelque chose à voir, toucher, tester, essayer, goûter, manipuler sur le stand
4. rendez_vous — conférence, atelier, démonstration à horaire, table ronde, masterclass, dégustation
5. preuve — un chiffre, un résultat client, une certification, un brevet, une norme, un label
6. contrepartie — une offre, une condition ou un tarif spécifiques au salon
7. tiers — un partenaire, un client, une institution nommés

PARTIE 2 — LES AUTORISATIONS NARRATIVES
Ce ne sont PAS des ancres. Elles ne comptent pas dans le nombre d'ancres et n'entrent pas dans le calcul de "suffisant". Elles servent uniquement à autoriser ou interdire des temps du récit lors de la rédaction.

- obstacle_source : les mots EXACTS du texte qui énoncent une difficulté, un manque, une limite, une contrainte ou un problème rencontré. Si le texte n'en énonce aucun, c'est null. Ne déduis rien, ne devine rien, ne considère pas qu'un besoin implicite est un obstacle. Une annonce sans obstacle est parfaitement normale : une dégustation, un anniversaire, une nouvelle gamme de coloris ou un partenariat n'ont aucune raison d'en avoir un.
- beneficiaire_source : les mots EXACTS désignant à qui cela s'adresse, si le texte le dit. Sinon null.

PARTIE 3 — LES FORMULATIONS CREUSES
Repère celles que la plupart des exposants emploient faute de mieux : « au plaisir de vous rencontrer », « venez échanger sur vos problématiques », « n'hésitez pas à passer nous voir », « toute l'équipe vous attend », « retrouvez-nous sur le stand ».

Réponds UNIQUEMENT par un objet JSON valide, sans préambule ni backticks :
{
  "ancres": [{"famille": "<une des sept>", "extrait": "<les mots exacts du texte, jamais reformulés>"}],
  "obstacle_source": null,
  "beneficiaire_source": null,
  "formulations_creuses": ["<extrait exact>"],
  "type_suggere": "Launch|Update|Demo|Special_Offer|Partnership|Innovation",
  "suffisant": true,
  "question": null
}

Règles :
- N'inscris une ancre, un obstacle ou un bénéficiaire que si tu peux citer les mots EXACTS du texte qui les portent. Pas d'extrait, pas d'entrée.
- "suffisant" est vrai dès qu'au moins une ancre est présente, indépendamment de obstacle_source.
- Si aucune ancre n'est trouvée, "suffisant" est faux et "question" contient UNE seule question, courte, adressée au manque précis, adaptée au type déclaré ou déduit :
  Demo → que verra concrètement le visiteur, et à quel moment ?
  Launch → quelle est la désignation de ce qui est lancé, et qu'est-ce qui change pour l'utilisateur ?
  Update → qu'est-ce qui évolue par rapport à la version précédente, et pour qui cela compte-t-il ?
  Partnership → avec qui, et qu'est-ce que cela permet de faire que vous ne pouviez pas faire seul ?
  Special_Offer → quelle est la condition exacte, et jusqu'à quand ?
  Innovation → qu'est-ce que le visiteur pourra voir ou comprendre sur le stand ?
- La question s'adresse à un professionnel, d'égal à égal. Jamais de reproche, jamais de note, jamais de score.
- Si "suffisant" est vrai, "question" vaut null.`;

const SYSTEM_GENERER = `Tu rédiges une Nouveauté pour Lotexpo, l'annonce qu'un exposant publie avant un salon professionnel. Ton rôle est de révéler pourquoi ce qu'il présente compte pour un visiteur, à partir des seuls faits qu'il a fournis.

Une Nouveauté n'est pas forcément un produit. Une conférence, une démonstration, un atelier, une étude, un partenariat, un service, une animation ou une avant-première sont des Nouveautés légitimes. Ce que tu racontes dépend de la nature de l'annonce :
- Produit : le problème qu'il aide à résoudre
- Démonstration : ce que le visiteur pourra constater de ses yeux
- Conférence : la question à laquelle il obtiendra une réponse
- Étude : la décision qu'elle permet d'éclairer
- Innovation : la limite actuelle qu'elle cherche à dépasser
- Service : l'étape qu'il rend plus simple ou plus fiable
- Atelier : ce avec quoi le participant repartira
- Retour d'expérience : l'enseignement directement applicable
- Partenariat : ce que l'association permet de faire
- Offre : ce qu'elle change concrètement pour l'acheteur

PRINCIPE CENTRAL : ne raconte pas ce qui est présenté, raconte ce que cela permet. Le visiteur professionnel est le personnage principal, l'exposant est celui qui l'aide à avancer. L'exposant n'a jamais besoin de se dire innovant, expert, leader ou incontournable : il le démontre en étant utile.

TEMPS NARRATIFS AUTORISÉS
Tu reçois un objet \`ancres\` issu de l'analyse. Chaque temps narratif n'est autorisé que si sa matière existe. Un temps sans matière n'est PAS écrit, et n'est pas remplacé par une formulation vague.

- Obstacle : autorisé UNIQUEMENT si \`obstacle_source\` est non nul. Sinon, n'évoque AUCUNE difficulté, AUCUN manque, AUCUNE limite. Ne écris pas « les équipes peinent souvent à », « il est difficile aujourd'hui de », ni aucune variante.
- Conséquence de l'obstacle : autorisée uniquement si l'obstacle est autorisé ET que la source en énonce l'effet.
- Preuve chiffrée, résultat, certification, client nommé : autorisée uniquement si l'ancre \`preuve\` ou \`tiers\` est présente, et avec les valeurs exactes de la source.
- Activité sur le stand (démonstration, essai, atelier, rendez-vous, dégustation) : autorisée uniquement si l'ancre \`experience\` ou \`rendez_vous\` est présente. N'invente JAMAIS ce qui se passera sur le stand, et ne prends aucun engagement au nom de l'exposant.
- Primeur, première, avant-première : autorisée uniquement si l'ancre \`exclusivite\` est présente.
- Public visé : tu peux t'appuyer sur les profils visiteurs du contexte Lotexpo, qui sont des données observées. Mais la mission de ce public et ses difficultés ne peuvent venir que du texte de l'exposant.

Quand la matière est mince, écris court et concret. Une annonce brève et vraie vaut mieux qu'un récit complet et supposé.

FORMULATIONS PRUDENTES
Quand tu décris une situation, ne la généralise jamais. Écris « pour les équipes confrontées à » plutôt que « toutes les entreprises souffrent de ». Si tu emploies une scène pour rendre concret, elle doit être explicitement hypothétique : « imaginez devoir comparer » et jamais « l'an dernier, une entreprise a ». N'invente ni client, ni témoignage, ni date, ni incident, ni citation, ni résultat.

OUVERTURE
Ne commence jamais par la participation au salon ni par le nom de l'entreprise. Commence par l'élément le plus intéressant dont tu disposes réellement : une question, une situation reconnaissable, un fait vérifié de la source, une possibilité nouvelle. Les trois angles que tu produis doivent avoir des ouvertures de NATURES DIFFÉRENTES, pas trois variantes de la même question.

TROUVABILITÉ
Le titre et le résumé sont utilisés pour retrouver cette Nouveauté dans un moteur de recherche. Ils doivent contenir le vocabulaire métier concret : ce dont il s'agit, le domaine, la désignation si elle existe. La narration et la mise en tension vivent dans reason_1, pas dans le titre. Un titre uniquement interrogatif et sans vocabulaire métier est une faute.

FORMAT
- title : 60 à 90 caractères, sans nom de salon, sans date, sans point final, avec du vocabulaire métier concret.
- reason_1 : 200 à 500 caractères. C'est là que se joue la narration.
- reason_2, reason_3 : 100 à 300 caractères, ou null si la matière ne les porte pas.
- summary : une phrase, 100 à 160 caractères, concrète.
- audience_tags : 2 à 5 profils d'acheteurs.
- type : valeur EXACTE parmi Launch, Update, Demo, Special_Offer, Partnership, Innovation.

Style : français professionnel, factuel. Aucun superlatif creux, aucune expression du type « solution innovante » ou « acteur de référence ». Aucun tiret cadratin. Aucun emoji.

Produis TROIS angles réellement distincts. Si la matière n'en permet que deux honnêtement, n'en produis que deux.

Réponds UNIQUEMENT par un objet JSON valide, sans préambule ni backticks :
{
  "angles":[{"id":"a1","libelle":"…","ouverture":"question|scene|fait|possibilite",
    "temps_utilises":["hero","mission","preuve"],
    "title":"…","type":"…","reason_1":"…","reason_2":null,"reason_3":null,
    "summary":"…","audience_tags":["…"]}],
  "faits_utilises":["…"],
  "temps_ecartes":[{"temps":"obstacle","raison":"absent de la source"}]
}

"faits_utilises" doit permettre de vérifier que tu n'as rien ajouté : si un élément de ta rédaction n'y figure pas, retire-le. "temps_ecartes" doit lister ce que tu as volontairement renoncé à écrire faute de matière : c'est la preuve que tu n'as pas comblé les vides.`;

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
  const analyseInput = body?.analyse;

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
  if (action === 'generer') {
    if (!analyseInput || typeof analyseInput !== 'object' || Array.isArray(analyseInput)) {
      return jsonResp({
        error: 'analyse_requise',
        message: "L'action generer doit recevoir le résultat de l'action analyser.",
      }, 400);
    }
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
  const userMessageParts = [
    '=== CONTEXTE LOTEXPO (JSON) ===',
    JSON.stringify(ctx, null, 2),
    '',
    `=== TYPE DÉCLARÉ PAR L'EXPOSANT ===`,
    typeLabel,
    '',
  ];
  if (action === 'generer') {
    userMessageParts.push(
      '=== ANALYSE (résultat de l\'action analyser, JSON) ===',
      JSON.stringify(analyseInput, null, 2),
      '',
    );
  }
  userMessageParts.push(`=== TEXTE DE L'EXPOSANT ===`, trimmed);
  const userMessage = userMessageParts.join('\n');

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
      extrait: a.extrait,
    }));

    const formulations_creuses = Array.isArray(p.formulations_creuses)
      ? p.formulations_creuses.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
      : [];

    const type_suggere = NOVELTY_TYPES.has(p.type_suggere)
      ? p.type_suggere
      : (typeInput && NOVELTY_TYPES.has(typeInput) ? typeInput : null);

    const obstacle_source =
      typeof p.obstacle_source === 'string' && p.obstacle_source.trim().length > 0
        ? p.obstacle_source
        : null;
    const beneficiaire_source =
      typeof p.beneficiaire_source === 'string' && p.beneficiaire_source.trim().length > 0
        ? p.beneficiaire_source
        : null;

    const suffisant = ancres.length > 0;
    const question = suffisant ? null : (typeof p.question === 'string' ? p.question : null);

    return jsonResp({
      ancres,
      nb_ancres: ancres.length,
      obstacle_source,
      beneficiaire_source,
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
  const obstacleSourceAnalyse =
    typeof (analyseInput as any)?.obstacle_source === 'string' &&
    (analyseInput as any).obstacle_source.trim().length > 0
      ? (analyseInput as any).obstacle_source
      : null;
  const alertes: string[] = [];
  const angles = anglesIn.map((a: any, i: number) => {
    const temps_utilises = Array.isArray(a?.temps_utilises)
      ? a.temps_utilises.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
      : [];
    const temps_ecartes = Array.isArray(a?.temps_ecartes)
      ? a.temps_ecartes.filter((t: any) => t && typeof t === 'object')
      : [];
    const angle: Record<string, unknown> = {
      id: typeof a?.id === 'string' && a.id ? a.id : `a${i + 1}`,
      libelle: typeof a?.libelle === 'string' ? a.libelle : '',
      ouverture: typeof a?.ouverture === 'string' ? a.ouverture : null,
      temps_utilises,
      temps_ecartes,
      title: typeof a?.title === 'string' ? a.title : '',
      type: NOVELTY_TYPES.has(a?.type) ? a.type : fallbackType,
      reason_1: typeof a?.reason_1 === 'string' ? a.reason_1 : '',
      reason_2: typeof a?.reason_2 === 'string' ? a.reason_2 : null,
      reason_3: typeof a?.reason_3 === 'string' ? a.reason_3 : null,
      summary: typeof a?.summary === 'string' ? a.summary : '',
      audience_tags: Array.isArray(a?.audience_tags)
        ? a.audience_tags.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
        : [],
    };
    if (temps_utilises.includes('obstacle') && !obstacleSourceAnalyse) {
      angle.alerte = 'obstacle_non_source';
      if (!alertes.includes('obstacle_non_source')) alertes.push('obstacle_non_source');
    }
    return angle;
  });

  const faits_utilises = Array.isArray(p.faits_utilises)
    ? p.faits_utilises.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
    : [];

  const temps_ecartes_global = Array.isArray(p.temps_ecartes)
    ? p.temps_ecartes.filter((t: any) => t && typeof t === 'object')
    : [];

  return jsonResp({ angles, faits_utilises, temps_ecartes: temps_ecartes_global, alertes, model: res.model });
});