// supabase/functions/recherche-ia-visiteur/index.ts
//
// Agent conversationnel "Recherche IA Visiteur" pour Lotexpo.
// Boucle de tool-calling (Claude Haiku) sur 4 primitives SQL déjà en base.
// Gate crédits (anonyme = 3 / inscrit = 6, paywall mimé) + rate-limit IP.
//
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-haiku-4-5-20251001";
const MAX_ITERS = 5;              // garde-fou boucle tool-calling
const IP_LIMIT_PER_HOUR = 30;     // garde-fou anti-abus par IP
const MAX_QUESTION_LEN = 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Outils exposés à Claude -------------------------------------------------
const TOOLS = [
  {
    name: "rechercher_salons",
    description:
      "Trouve des SALONS pertinents pour un besoin métier exprimé en langage naturel. " +
      "`intention` = description du besoin (ex: 'logiciels de gestion pour la restauration'). " +
      "`pour_visiter` = true si l'utilisateur veut VISITER un salon → ne renvoie que des salons dont une édition est À VENIR. " +
      "`pour_visiter` = false s'il cherche où EXPOSER → renvoie aussi les salons du domaine dont la prochaine édition n'est pas encore annoncée " +
      "(champs `a_venir` et `prochaine_date` par salon). " +
      "Chaque salon renvoie: salon_label, ville via les instances, nb_exposants_matchants (densité), prochaine_date, a_venir, " +
      "instances_a_venir (éditions à venir avec ville/date/slug) et exemples_exposants.",
    input_schema: {
      type: "object",
      properties: {
        intention: { type: "string", description: "Le besoin/thème en langage naturel." },
        pour_visiter: { type: "boolean", description: "true = visiter (à venir seulement) ; false = exposer (tout l'historique + prochaine date)." },
      },
      required: ["intention", "pour_visiter"],
    },
  },
  {
    name: "identifier_entreprise",
    description:
      "Résout un NOM d'entreprise OU un site/domaine vers un identifiant exposant. " +
      "À appeler EN PREMIER pour toute question 'où expose [entreprise]'. " +
      "Renvoie des candidats avec `methode` (domaine/nom_exact/nom_approx), `score`, et `expose_bientot` (l'entreprise a-t-elle une présence sur un salon à venir). " +
      "Si plusieurs candidats à score élevé (doublons de fiches), demande à l'utilisateur de préciser, ou combine leurs salons.",
    input_schema: {
      type: "object",
      properties: {
        nom_ou_site: { type: "string", description: "Nom d'entreprise ou domaine/URL." },
      },
      required: ["nom_ou_site"],
    },
  },
  {
    name: "salons_d_une_entreprise",
    description:
      "Liste les salons d'une entreprise via son `exhibitor_id` (obtenu par identifier_entreprise). " +
      "`seulement_a_venir` = true par défaut. Renvoie nom_event, ville, date_debut, date_fin, stand_exposant (numéro de stand), a_venir.",
    input_schema: {
      type: "object",
      properties: {
        exhibitor_id: { type: "string" },
        seulement_a_venir: { type: "boolean" },
      },
      required: ["exhibitor_id"],
    },
  },
  {
    name: "rechercher_entreprises",
    description:
      "Trouve des ENTREPRISES exposantes proches d'un thème. Usage principal = REPLI : " +
      "quand un concurrent nommé n'expose sur aucun salon à venir (expose_bientot=false), cherche ici des entreprises similaires " +
      "qui, elles, exposent bientôt, en passant `seulement_a_venir=true`. " +
      "`intention` = thème ou description de l'activité du concurrent. Chaque résultat renvoie ses salons à venir dans `salons`.",
    input_schema: {
      type: "object",
      properties: {
        intention: { type: "string" },
        seulement_a_venir: { type: "boolean" },
      },
      required: ["intention", "seulement_a_venir"],
    },
  },
  {
    name: "exposants_d_un_salon",
    description:
      "Donne les EXPOSANTS et les CATÉGORIES d'un salon précis, identifié par son nom ou son slug (ex: 'SPACE'). " +
      "SANS `sous_secteur` : renvoie nb_exposants (total), categories_macro (répartition par grande catégorie), " +
      "categories_sous_secteurs (répartition fine, top 20) et echantillon_exposants (quelques noms). " +
      "AVEC `sous_secteur` (un nom issu de categories_sous_secteurs) : renvoie la liste des exposants de cette catégorie au salon, avec leur stand. " +
      "À utiliser pour toute question 'quels exposants / quelles catégories au salon X'.",
    input_schema: {
      type: "object",
      properties: {
        salon: { type: "string", description: "Nom ou slug du salon (ex: 'SPACE' ou 'space')." },
        sous_secteur: { type: "string", description: "Optionnel. Nom d'un sous-secteur pour lister ses exposants au salon." },
      },
      required: ["salon"],
    },
  },
];

// --- System prompt : la discipline anti-échec-silencieux ---------------------
function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Tu es l'assistant de recherche de Lotexpo, plateforme des salons professionnels français. Tu aides un visiteur à trouver LES BONS salons et exposants pour son besoin. Date du jour : ${today}.

RÈGLES ABSOLUES (ne jamais enfreindre) :
- Tu ne connais QUE ce que les outils te renvoient. N'invente jamais un salon, une entreprise, une date ou un stand qui n'apparaît pas dans un résultat d'outil.
- Ne recommande JAMAIS à un visiteur un salon déjà passé. Un salon n'est recommandable pour une VISITE que s'il a une édition à venir (a_venir = true / présence dans instances_a_venir).
- Si le résultat est mince (peu ou pas d'exposants pertinents sur des salons à venir), DIS-LE honnêtement plutôt que de gonfler une réponse. Ex : « Peu d'exposants de ce domaine exposent d'ici la fin de l'année ; le plus proche est X (ville, date). »
- Ne fabrique jamais une fausse impression de certitude. Une réponse honnête et partielle vaut mieux qu'une réponse plausible mais fausse.

DISTINGUER LES DEUX INTENTIONS « quels salons » :
- L'utilisateur veut VISITER (« à quels salons aller pour voir X ») → rechercher_salons avec pour_visiter=true. Ne présente que des éditions à venir.
- L'utilisateur veut EXPOSER (« sur quel salon exposer si je fais X ») → rechercher_salons avec pour_visiter=false. Le salon le plus dense du domaine peut être passé : présente-le comme LA référence du domaine, et donne sa prochaine_date si a_venir=true, sinon dis « prochaine édition pas encore annoncée ».

« OÙ EXPOSE [ENTREPRISE] » (question sur l'empreinte salon d'une entreprise — passé ET à venir) :
1. identifier_entreprise d'abord. Si aucun candidat, dis que l'entreprise n'est pas trouvée dans l'index et propose de reformuler ou de décrire son activité.
2. Dès qu'un candidat plausible est trouvé — MÊME si expose_bientot=false — appelle TOUJOURS salons_d_une_entreprise avec seulement_a_venir=false, pour récupérer TOUT son historique (salons passés ET à venir).
3. Présente son empreinte réelle, en distinguant clairement :
   - éditions À VENIR (a_venir=true) : « expose à [salon] ([ville], [dates]), stand [n°] ».
   - éditions PASSÉES (a_venir=false) : « a exposé à [salon] ([dates]), stand [n°] ».
   Ne dis JAMAIS « n'expose sur aucun salon » quand l'entreprise a un historique : montre ce qu'elle a fait, avec les liens (/events/{slug}).
4. Si l'entreprise n'a AUCUNE édition à venir : présente d'abord son historique passé, PUIS précise « pas d'édition à venir annoncée pour l'instant ». Tu peux, en complément et seulement si c'est utile, proposer des acteurs similaires qui exposent bientôt (rechercher_entreprises, seulement_a_venir=true) — mais l'entreprise demandée et son historique passent EN PREMIER.
5. Fiches en doublon (« X » et « X S.R.L ») → même entreprise, combine leurs salons.

RÉSOLUTION D'ENTREPRISE — deux cas à ne jamais confondre :
- Si identifier_entreprise ne renvoie AUCUN candidat → l'entreprise est absente de l'index. Dis-le.
- Si des candidats sont renvoyés → l'entreprise EST dans l'index. NOMME-la (avec son lien) et présente son historique COMPLET via salons_d_une_entreprise (seulement_a_venir=false), passé inclus. Ne dis JAMAIS « n'expose sur aucun salon » sans avoir vérifié le passé. Une entreprise sans salon à venir a très probablement un historique : montre-le.
- Ne dis JAMAIS « je ne trouve pas cette entreprise » quand un candidat plausible a été renvoyé — même s'il n'expose pas, même si le nom n'est pas exact (ex. « Trivec » → « Trivec by Caspeco »). Nomme le candidat le plus probable.

PERTINENCE DES SALONS :
- Un salon avec un seul exposant matchant, surtout s'il est généraliste et sans rapport avec le thème (ex. un salon de collectivités pour une requête « logiciel de restauration »), n'est PAS « un salon pour ce domaine ». Ne le présente pas comme une recommandation.
- Au mieux, mentionne-le en le qualifiant honnêtement : « l'entreprise X de votre domaine y expose, mais ce salon n'est pas centré sur votre sujet ».
- Priorise toujours les salons denses / spécialisés (plusieurs exposants matchants). S'il y a peu de salons vraiment pertinents à venir, dis-le franchement plutôt que de compléter avec des salons tangentiels.

EXPOSANTS ET CATÉGORIES D'UN SALON (« qui expose à X », « quelles catégories à X ») :
- Appelle exposants_d_un_salon avec le nom ou le slug du salon. L'information PRINCIPALE que tu restitues = les CATÉGORIES et leurs volumes (categories_macro + 2-3 sous-secteurs marquants). C'est là qu'est la valeur.
- Tu peux citer QUELQUES exposants en exemple (echantillon_exposants, déjà limité) en les liant : [nom](/exposants/{public_slug}).
- Tu n'as JAMAIS la liste complète et tu ne dois PAS chercher à la reconstituer. Pour « tous les exposants » / « la liste complète », renvoie TOUJOURS vers la page du salon : « La liste complète des exposants est sur la page du salon : [Nom du salon](/events/{slug}) » (champ page_salon).
- Drill-down (catégorie précise) : rappelle exposants_d_un_salon avec sous_secteur. Annonce nb_exposants_total (ex. « 137 exposants en nutrition animale »), donne l'aperçu limité (apercu_exposants, lié via public_slug), PUIS renvoie vers page_salon pour la liste entière. Ne liste JAMAIS plus que ce que l'outil renvoie.

CE QUE TU CONNAIS DU SITE — RIEN D'AUTRE :
- Uniquement les pages salon (/events/{slug}) et les pages exposant (/exposants/{public_slug}), quand un slug est présent dans un résultat d'outil.
- Tu PEUX donner les exposants et les catégories d'un salon via exposants_d_un_salon. En dehors de cette capacité, n'invente JAMAIS de fonctionnalité ni de nom de filtre précis du site.
- Pour une demande que tes outils ne couvrent réellement pas (ex. localisation physique précise d'un stand, filtre spécifique de l'interface) : invite à explorer le salon sur lotexpo.com, SANS nommer de filtre spécifique.

LIENS (obligatoire dès que l'info est disponible dans les résultats d'outil) :
- Quand tu nommes un SALON, mets son nom en lien markdown vers sa page : [Nom du salon](/events/{slug}), en utilisant le champ \`slug\` du résultat d'outil correspondant (l'instance précise que tu cites dans instances_a_venir[].slug, ou salons[].slug, ou le slug renvoyé par salons_d_une_entreprise).
- Quand tu nommes une ENTREPRISE / un exposant, mets son nom en lien markdown vers sa page : [Nom exposant](/exposants/{public_slug}), en utilisant le champ \`public_slug\` renvoyé par identifier_entreprise, rechercher_entreprises, ou exposants_d_un_salon (echantillon_exposants[].public_slug et apercu_exposants[].public_slug).
- N'INVENTE JAMAIS un slug. Si un résultat n'a pas de \`slug\` / \`public_slug\`, cite l'élément sans lien. Toujours des chemins relatifs (/events/…, /exposants/…), jamais d'URL absolue.

STYLE : français, B2B, concis et actionnable. Pour chaque salon recommandé : nom, ville, date, POURQUOI (ex. « ~X exposants du domaine »), et 1-2 exposants en exemple. Pas de blabla, pas de superlatifs creux. Termine par une réponse claire, pas une liste d'outils.`;
}

// --- Appel RPC avec un retry (couvre les pannes réseau/connexion base) --------
async function callRpc(admin: any, fn: string, args: any) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await admin.rpc(fn, args);
    if (!error) return data;
    if (attempt === 0) { await new Promise((r) => setTimeout(r, 400)); continue; }
    return { error: error.message };
  }
}

// --- Exécution d'un outil = appel de la RPC Supabase correspondante ----------
async function runTool(admin: any, name: string, input: any) {
  try {
    if (name === "rechercher_salons") {
      return await callRpc(admin, "match_salons_semantic", {
        p_query: String(input.intention ?? ""),
        p_k: 12,
        p_upcoming_only: input.pour_visiter ?? true,
        p_min_sim: 0.48,
      });
    }
    if (name === "identifier_entreprise") {
      return await callRpc(admin, "resolve_exhibitor", {
        p_query: String(input.nom_ou_site ?? ""),
        p_k: 5,
      });
    }
    if (name === "salons_d_une_entreprise") {
      return await callRpc(admin, "get_exhibitor_salons", {
        p_exhibitor_id: String(input.exhibitor_id ?? ""),
        p_upcoming_only: input.seulement_a_venir ?? true,
      });
    }
    if (name === "rechercher_entreprises") {
      return await callRpc(admin, "match_exhibitors_global", {
        p_query: String(input.intention ?? ""),
        p_threshold: 0.32,
        p_k: 20,
        p_upcoming_only: input.seulement_a_venir ?? true,
      });
    }
    if (name === "exposants_d_un_salon") {
      return await callRpc(admin, "exposants_d_un_salon", {
        p_salon: String(input.salon ?? ""),
        p_sous_secteur: input.sous_secteur ? String(input.sous_secteur) : null,
      });
    }
    return { error: "outil inconnu" };
  } catch (e) {
    return { error: String(e).slice(0, 300) };
  }
}

// ===== R1 : circuit intelligence anonyme (post-réponse, non bloquant) =====
const CLASSIFY_TAXO = `Agroalimentaire & Boissons : Agriculture & élevage | Agroalimentaire & transformation alimentaire | Boissons, vins & spiritueux | Horticulture & production végétale | Machines & équipements agricoles | Nutrition & alimentation animale | Restauration & services alimentaires
Automobile & Mobilité : Aéronautique & aérospatial | Automobile & motos | Cycle & micromobilité | Équipementiers & pièces | Ferroviaire | Maritime & naval | Mobilité & services de transport
BTP & Construction : Construction, bâtiment & gros œuvre | Matériaux de construction & revêtements | Menuiserie, fermetures & aménagement | Rénovation & second œuvre | Travaux publics & aménagement extérieur
Commerce & Distribution : Commerce de détail & retail | Distribution & commerce de gros | Import / export | Logistique, transport & supply chain
Cosmétique & Bien-être : Bien-être & soins | Cosmétiques & produits de beauté | Parfumerie
Éducation & Formation : Enseignement & éducation | Formation professionnelle | Médias & édition spécialisée
Énergie & Environnement : Eau, assainissement & traitement | Énergies renouvelables & transition énergétique | Environnement & développement durable | Gestion des déchets & recyclage
Finance, Assurance & Immobilier : Assurance | Capital-investissement | Gestion de patrimoine & d'actifs | Immobilier | Services financiers & investissement
Industrie & Production : Automatisation & robotique industrielle | Bois & transformation du bois | Chimie, matériaux & composites | Électronique & composants | Emballage & conditionnement | Machines-outils & équipements industriels | Mécanique de précision & usinage | Métallurgie & travail des métaux | Plasturgie & transformation des plastiques | Sous-traitance industrielle
Mode & Textile : Accessoires & maroquinerie | Bijouterie, joaillerie & luxe | Chaussure | Mode & habillement | Textile & confection
Santé & Médical : Dispositifs & équipements médicaux | Pharmacie & biotechnologies | Santé & prévention
Secteur Public & Collectivités : Administration & collectivités territoriales | Sécurité & défense | Services publics
Services aux Entreprises & RH : Conseil & services professionnels | Marketing & communication | Ressources humaines & recrutement | Services aux entreprises (généraux)
Technologie & Innovation : Cybersécurité & protection des données | IA, data & innovation | Informatique & télécommunications | Logiciels & SaaS | Services numériques & transformation digitale
Tourisme & Événementiel : Événementiel | Hôtellerie | Loisirs & divertissement | Sports & plein air | Tourisme & voyages`;

const CLASSIFY_SYSTEM = `Tu analyses une question posée à la Recherche IA de Lotexpo pour produire des métadonnées analytiques ANONYMES.
Réponds UNIQUEMENT avec un objet JSON valide, sans préambule ni backticks :
{"intent":"decouverte_salon|recherche_exposant|preparation_visite|comparaison|hors_sujet|autre","macro_sector_name":"<un nom EXACT de la liste ou null>","sub_sector_names":["<0 à 3 noms EXACTS de la liste>"],"query_sanitized":"<la question, avec les noms de PERSONNES remplacés par [PERSONNE] et les auto-références de l'entreprise de l'utilisateur par [ENTREPRISE_UTILISATEUR]. CONSERVE les noms de salons et d'exposants recherchés.>"}

## TAXONOMIE (macro : sous-secteurs)
${CLASSIFY_TAXO}

Règles : macro_sector_name = le domaine dominant (null si hors sujet). sub_sector_names = 0 à 3, noms EXACTS de la liste. N'invente aucun nom hors liste.`;

const VALID_INTENTS = ["decouverte_salon","recherche_exposant","preparation_visite","comparaison","hors_sujet","autre"];

function sanitizeRegex(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]")
    .replace(/https?:\/\/[^\s]+/gi, "[URL_PERSO]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[IBAN]")
    .replace(/\b\d{14}\b/g, "[SIRET]")
    .replace(/\b\d{9}\b/g, "[SIREN]")
    .replace(/\+?\d[\d\s.\-]{7,}\d/g, "[TEL]");
}

function extractEventSlugs(text: string): string[] {
  const set = new Set<string>(); const re = /\/events\/([a-z0-9-]+)/gi; let m;
  while ((m = re.exec(text)) !== null) set.add(m[1].toLowerCase());
  return [...set];
}
function countExhibitorLinks(text: string): number {
  const set = new Set<string>(); const re = /\/exposants\/([a-z0-9-]+)/gi; let m;
  while ((m = re.exec(text)) !== null) set.add(m[1].toLowerCase());
  return set.size;
}

async function classifyQuestion(sanitizedQuestion: string): Promise<any> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system: CLASSIFY_SYSTEM, messages: [{ role: "user", content: sanitizedQuestion }] }),
  });
  if (!resp.ok) throw new Error("classify_http_" + resp.status);
  const data = await resp.json();
  let txt = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  txt = txt.replace(/^```json/i, "").replace(/```$/, "").trim();
  return JSON.parse(txt);
}

async function logIntelligence(admin: any, question: string, questionRank: number, conversationKey: string, finalText: string) {
  try {
    const regexed = sanitizeRegex(question);
    const eventSlugs = extractEventSlugs(finalText);
    const exhCount = countExhibitorLinks(finalText);
    const hadResults = eventSlugs.length > 0 || exhCount > 0;

    let cls: any = null;
    try { cls = await classifyQuestion(regexed); } catch (_) { cls = null; }
    const ok = cls && typeof cls.query_sanitized === "string" && cls.query_sanitized.length <= regexed.length + 80;

    await admin.rpc("insert_ai_search_event", ok ? {
      p_conversation_key: conversationKey, p_question_rank: questionRank, p_persona: "inconnu",
      p_query_sanitized: cls.query_sanitized, p_sanitization_status: "ok",
      p_intent_type: VALID_INTENTS.includes(cls.intent) ? cls.intent : "autre",
      p_macro_sector_name: cls.macro_sector_name ?? null,
      p_sub_sector_names: Array.isArray(cls.sub_sector_names) ? cls.sub_sector_names : [],
      p_event_slugs: eventSlugs, p_matched_exhibitor_count: exhCount, p_answer_had_results: hadResults,
    } : {
      p_conversation_key: conversationKey, p_question_rank: questionRank, p_persona: "inconnu",
      p_query_sanitized: null, p_sanitization_status: "fallback_metadata_only",
      p_intent_type: null, p_macro_sector_name: null, p_sub_sector_names: [],
      p_event_slugs: eventSlugs, p_matched_exhibitor_count: exhCount, p_answer_had_results: hadResults,
    });
  } catch (_) { /* ne JAMAIS impacter la réponse utilisateur */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Authentification (anonyme ou inscrit — les deux ont un JWT)
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!jwt) return json({ error: "non_authentifie" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "non_authentifie" }, 401);
  const user = userData.user;
  const userId = user.id;
  const isAnon = user.is_anonymous === true;

  // 2) Corps
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "corps_invalide" }, 400); }
  const question = String(body?.question ?? "").trim().slice(0, MAX_QUESTION_LEN);
  if (!question) return json({ error: "question_vide" }, 400);
  const history = Array.isArray(body?.history)
    ? body.history
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-10)
    : [];

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  const conversationKey = (typeof body?.conversation_key === "string" && /^[0-9a-f-]{36}$/i.test(body.conversation_key))
    ? body.conversation_key : crypto.randomUUID();
  const questionRank = history.filter((m: any) => m.role === "user").length + 1;

  let ipHash: string | null = null;
  if (ip) {
    const daySalt = await sha256Hex((Deno.env.get("AI_RL_SALT") ?? "") + new Date().toISOString().slice(0, 10));
    ipHash = await sha256Hex(ip + daySalt);
  }

  // 3) Gate crédits — AVANT le rate-limit IP (pour en exempter les admins)
  const { data: creditRows, error: creditErr } = await admin.rpc("check_ai_credits", {
    p_user_id: userId,
    p_is_anonymous: isAnon,
  });
  if (creditErr) return json({ error: "credit_check_failed", detail: creditErr.message }, 500);
  const credit = Array.isArray(creditRows) ? creditRows[0] : creditRows;
  if (credit?.wall_type) {
    const evt = credit.wall_type === "signup" ? "anon_wall_shown" : "paid_wall_shown";
    await admin.from("ai_funnel_events").insert({ user_id: userId, event_type: evt });
    return json({ wall: { type: credit.wall_type }, credits: credit });
  }
  // Les admins ont une allocation illimitée (999999) ; anonyme = 3, inscrit = 6.
  const isAdmin = (credit?.allowed ?? 0) > 6;

  // 4) Rate-limit IP anti-abus (hash d'IP salé, non réversible) — non-admins
  if (!isAdmin && ipHash) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from("ai_rate_limit_hits")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= IP_LIMIT_PER_HOUR) {
      return json({ error: "rate_limited", message: "Trop de requêtes récentes. Réessaie dans un moment." }, 429);
    }
    await admin.from("ai_rate_limit_hits").insert({ ip_hash: ipHash });
  }

  // 5) Boucle de tool-calling (Haiku)
  const messages: any[] = [...history, { role: "user", content: question }];
  let finalText = "";
  try {
    for (let i = 0; i < MAX_ITERS; i++) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1500,
          system: systemPrompt(),
          tools: TOOLS,
          messages,
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        return json({ error: "anthropic_error", detail: t.slice(0, 400) }, 502);
      }
      const data = await resp.json();
      messages.push({ role: "assistant", content: data.content });

      if (data.stop_reason === "tool_use") {
        const toolResults: any[] = [];
        for (const block of data.content ?? []) {
          if (block.type === "tool_use") {
            const result = await runTool(admin, block.name, block.input ?? {});
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      finalText = (data.content ?? [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
      break;
    }
  } catch (e) {
    return json({ error: "loop_failed", detail: String(e).slice(0, 300) }, 500);
  }
  if (!finalText) {
    finalText = "Je n'ai pas réussi à produire une réponse cette fois-ci. Peux-tu reformuler ta demande ?";
  }

  // 6) Log de l'usage (crédit consommé sur succès) + réponse
  await admin.from("ai_search_usage").insert({
    user_id: userId,
    is_anonymous: isAnon,
  });

  const usedAfter = (credit?.used ?? 0) + 1;
  const allowed = credit?.allowed ?? (isAnon ? 3 : 6);
  const remainingAfter = Math.max(allowed - usedAfter, 0);

  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    (EdgeRuntime as any).waitUntil(logIntelligence(admin, question, questionRank, conversationKey, finalText));
  }

  return json({
    answer: finalText,
    conversation_key: conversationKey,
    credits: { used: usedAfter, allowed, remaining: remainingAfter },
    // Indice "mur imminent" pour que le front prépare le CTA (sans logguer d'event ici :
    // l'event sera loggé au prochain appel effectivement bloqué).
    wall: remainingAfter <= 0 ? { type: isAnon ? "signup" : "paywall", soft: true } : null,
  });
});