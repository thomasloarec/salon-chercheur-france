// supabase/functions/recherche-ia-visiteur/index.ts
//
// Agent conversationnel "Recherche IA Visiteur" pour Lotexpo.
// Boucle de tool-calling (Claude Haiku) sur les primitives SQL en base.
// Gate crédits (anonyme = 5 / inscrit = 10, paywall mimé) + rate-limit IP.
//
// v68 — Chantiers A/B/C : outil salons unifié (match_salons_v2 : catégories +
// zone géographique + bonus secteur + statut recommande/connexe), fiche_salon
// (résolution d'un salon par son nom), salons_des_concurrents. Reste inchangé.
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
      "Outil UNIQUE pour trouver des salons. Couvre tout : par theme metier, par ville, par echeance. " +
      "`intention` = le besoin en langage naturel (ex: 'logiciels pour la restauration'). Laisse-le vide pour une recherche purement geographique. " +
      "`ville` = contrainte de lieu (ex: 'Toulouse'). L'outil elargit automatiquement aux communes voisines (parcs d'expositions peripheriques). " +
      "`avant_le` = date ISO AAAA-MM-JJ pour une echeance ('cet automne' -> calcule la date depuis aujourd'hui). " +
      "`pour_visiter` = true pour visiter (editions a venir seulement), false pour exposer. " +
      "Chaque salon renvoie : statut ('recommande' ou 'connexe'), proximite ('exacte' ou 'proche'), nb_exposants_domaine, slug, categories_matchees.",
    input_schema: {
      type: "object",
      properties: {
        intention: { type: "string", description: "Besoin metier. Vide si recherche purement geographique." },
        ville: { type: "string", description: "Optionnel. Ville demandee." },
        avant_le: { type: "string", description: "Optionnel. Date ISO AAAA-MM-JJ (echeance)." },
        pour_visiter: { type: "boolean", description: "true = visiter (a venir), false = exposer." },
      },
      required: ["intention", "pour_visiter"],
    },
  },
  {
    name: "fiche_salon",
    description:
      "Verifie l'existence d'un salon nomme et renvoie son lieu exact, sa ville, son adresse, ses dates et sa couverture exposants. " +
      "A appeler pour toute question sur un salon precis : 'ou se trouve X', 'quand a lieu X', 'le salon X existe-t-il', 'X est a quelle adresse'. " +
      "Tolerant aux variantes de nom. Renvoie statut : 'ok', 'resolution_incertaine' ou 'salon_introuvable' (avec suggestions).",
    input_schema: {
      type: "object",
      properties: { nom: { type: "string", description: "Nom du salon (ex: 'SEPEM Toulouse')." } },
      required: ["nom"],
    },
  },
  {
    name: "salons_des_concurrents",
    description:
      "Repond a 'a quels salons exposent mes concurrents / les concurrents de X'. " +
      "Prend le NOM ou le DOMAINE d'une entreprise de reference, trouve les entreprises similaires, et renvoie les salons a venir " +
      "classes par nombre de concurrents presents, avec le detail. " +
      "Renvoie statut : 'ok', 'entreprise_introuvable', 'aucun_salon_a_venir', et resolution_ambigue (booleen).",
    input_schema: {
      type: "object",
      properties: { entreprise: { type: "string", description: "Nom ou domaine de l'entreprise de reference." } },
      required: ["entreprise"],
    },
  },
  {
    name: "identifier_entreprise",
    description:
      "Resout un NOM d'entreprise OU un site/domaine vers un identifiant exposant. A appeler EN PREMIER pour 'ou expose [entreprise]'. " +
      "Renvoie des candidats avec methode, score, public_slug et expose_bientot. Si plusieurs candidats a score eleve, ce sont des doublons : combine-les.",
    input_schema: {
      type: "object",
      properties: { nom_ou_site: { type: "string" } },
      required: ["nom_ou_site"],
    },
  },
  {
    name: "salons_d_une_entreprise",
    description:
      "Liste les salons d'une entreprise via son exhibitor_id (obtenu par identifier_entreprise). " +
      "`seulement_a_venir` = false pour recuperer TOUT l'historique (passe + a venir). Renvoie nom_event, ville, date_debut, stand_exposant, a_venir, slug.",
    input_schema: {
      type: "object",
      properties: { exhibitor_id: { type: "string" }, seulement_a_venir: { type: "boolean" } },
      required: ["exhibitor_id"],
    },
  },
  {
    name: "rechercher_entreprises",
    description:
      "Trouve des ENTREPRISES exposantes proches d'un theme. Repli quand une entreprise nommee n'expose sur aucun salon a venir : " +
      "cherche ici des acteurs similaires qui exposent bientot (seulement_a_venir=true). Chaque resultat renvoie ses salons a venir.",
    input_schema: {
      type: "object",
      properties: { intention: { type: "string" }, seulement_a_venir: { type: "boolean" } },
      required: ["intention", "seulement_a_venir"],
    },
  },
  {
    name: "exposants_d_un_salon",
    description:
      "Donne les EXPOSANTS et les CATEGORIES d'un salon precis (nom ou slug). SANS sous_secteur : nb_exposants, categories_macro, " +
      "categories_sous_secteurs (top 20), echantillon_exposants. AVEC sous_secteur : la liste des exposants de cette categorie au salon.",
    input_schema: {
      type: "object",
      properties: {
        salon: { type: "string" },
        sous_secteur: { type: "string", description: "Optionnel. Nom d'un sous-secteur pour lister ses exposants." },
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
- Tu ne connais QUE ce que les outils te renvoient. N'invente jamais un salon, une entreprise, une date, un lieu ou un stand qui n'apparaît pas dans un résultat d'outil.
- Ne recommande JAMAIS à un visiteur un salon déjà passé pour une VISITE. Un salon n'est recommandable que s'il a une édition à venir.
- Ne renvoie JAMAIS le visiteur hors de Lotexpo. Aucun lien, aucune adresse externe, aucune recommandation vers un site officiel de salon, un site d'exposant, un organisateur, un moteur de recherche ou une source de presse. Cela vaut même quand Lotexpo couvre mal le sujet et même si l'information existe évidemment ailleurs. Dans ce cas, dis honnêtement ce que tu ne sais pas et propose ce que Lotexpo couvre.
- Une réponse honnête et partielle vaut mieux qu'une réponse plausible mais fausse. Si le résultat est mince, dis-le.

TROUVER DES SALONS — un seul outil, rechercher_salons :
- Il couvre TOUT : par thème (intention), par ville (ville), par échéance (avant_le). Tu n'as pas à choisir entre plusieurs outils.
- Pour un besoin métier : remplis intention. Pour une contrainte de lieu : remplis ville. Pour une échéance comme « cet automne » ou « avant décembre » : calcule la date depuis aujourd'hui et remplis avant_le. Pour une question purement géographique (« salons à Lyon »), laisse intention vide et remplis ville.
- Chaque salon renvoie un statut. 'recommande' : présente-le normalement. 'connexe' : proche du sujet mais pas central, ne le présente jamais comme une recommandation principale ; tu peux le citer en complément en le qualifiant honnêtement (« ce salon touche votre domaine sans y être centré »).
- Chaque salon renvoie une proximite. 'exacte' : dans la ville demandée. 'proche' : dans une commune voisine (souvent le parc d'expositions). Pour 'proche', dis-le clairement : « à Aussonne, près de Toulouse ».
- Si rien ne revient, dis honnêtement que Lotexpo ne référence pas de salon pertinent pour cette demande. Ne renvoie pas ailleurs.

UN SALON NOMMÉ — fiche_salon :
- Pour toute question sur un salon précis (« où se trouve X », « quand a lieu X », « à quelle adresse », « X existe-t-il »), appelle fiche_salon avec le nom.
- Réponds directement avec la ville, le lieu et les dates renvoyés. Ne dis JAMAIS qu'un salon n'existe pas : si le statut est 'salon_introuvable', dis que tu ne le trouves pas dans l'index Lotexpo et propose les suggestions si elles sont plausibles.
- Si couverture_exposants vaut 'aucune', ne dis pas que le salon n'a pas d'exposants : dis que leur liste n'est pas encore disponible sur Lotexpo.

CONCURRENTS — salons_des_concurrents :
- Pour « à quels salons exposent mes concurrents » ou « les concurrents de X », appelle salons_des_concurrents avec le nom ou le domaine de l'entreprise de référence.
- Présente les salons renvoyés, classés par nombre de concurrents présents, en nommant les entreprises. Si resolution_ambigue est vrai, tu peux demander à préciser. Si 'entreprise_introuvable', dis que l'entreprise n'est pas dans l'index et propose de décrire son activité.

« OÙ EXPOSE [ENTREPRISE] » (empreinte salon d'une entreprise, passé ET à venir) :
1. identifier_entreprise d'abord. Aucun candidat -> dis que l'entreprise n'est pas dans l'index.
2. Dès qu'un candidat plausible est trouvé, MÊME si expose_bientot=false, appelle salons_d_une_entreprise avec seulement_a_venir=false pour tout l'historique.
3. Distingue les éditions À VENIR (« expose à [salon], [ville], [dates], stand [n°] ») des PASSÉES (« a exposé à [salon], [dates] »). Ne dis JAMAIS « n'expose sur aucun salon » quand il y a un historique.
4. Aucune édition à venir : présente l'historique passé, puis « pas d'édition à venir annoncée ». Tu peux en complément proposer des acteurs similaires (rechercher_entreprises, seulement_a_venir=true).
5. Fiches en doublon (« X » et « X S.R.L ») -> même entreprise, combine.

EXPOSANTS ET CATÉGORIES D'UN SALON (« qui expose à X », « quelles catégories à X ») :
- Appelle exposants_d_un_salon. L'information PRINCIPALE = les catégories et leurs volumes (categories_macro + 2-3 sous-secteurs). Cite quelques exposants en exemple via echantillon_exposants.
- Tu n'as JAMAIS la liste complète. Pour « tous les exposants », renvoie vers la page du salon (champ page_salon).
- Drill-down : rappelle exposants_d_un_salon avec sous_secteur, annonce nb_exposants_total, donne l'aperçu limité, puis renvoie vers page_salon.

LIENS (obligatoire dès que l'info est dans un résultat d'outil) :
- Un SALON : [Nom du salon](/events/{slug}) avec le champ slug du résultat.
- Une ENTREPRISE : [Nom](/exposants/{public_slug}) avec le champ public_slug.
- N'INVENTE JAMAIS un slug. Pas de slug -> cite le nom sans lien.
- N'utilise JAMAIS un champ website/url/domaine comme cible de lien. Le seul lien exposant valide est /exposants/{public_slug}.
- Tout lien commence par une barre oblique. /events/space est correct, events/space est FAUX.

STYLE : français, B2B, concis, actionnable. Pour chaque salon recommandé : nom (en lien), ville, date, pourquoi (ex. « ~X exposants du domaine »), 1-2 exposants en exemple. Pas de superlatifs creux. Termine par une réponse claire.`;
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
      const intention = String(input.intention ?? "").trim();
      const ville = String(input.ville ?? "").trim();
      return await callRpc(admin, "match_salons_v2", {
        p_query: intention.length > 0 ? intention : null,
        p_ville: ville.length > 0 ? ville : null,
        p_date_max: input.avant_le ? String(input.avant_le) : null,
        p_upcoming_only: input.pour_visiter ?? true,
        p_k: 12,
      });
    }
    if (name === "fiche_salon") {
      return await callRpc(admin, "fiche_salon", { p_salon: String(input.nom ?? "") });
    }
    if (name === "salons_des_concurrents") {
      return await callRpc(admin, "salons_des_concurrents", { p_nom_ou_site: String(input.entreprise ?? "") });
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

function collectSlugs(node: any, acc: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const v of node) collectSlugs(v, acc); return; }
  for (const [k, v] of Object.entries(node)) {
    if (k === "slug" && typeof v === "string" && v) acc.add(v.toLowerCase());
    else collectSlugs(v, acc);
  }
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

async function logIntelligence(admin: any, question: string, questionRank: number, conversationKey: string, finalText: string, retrievedSlugs: string[]) {
  try {
    const regexed = sanitizeRegex(question);
    const cited = extractEventSlugs(finalText);
    const eventSlugs = cited.length > 0 ? cited : (Array.isArray(retrievedSlugs) ? retrievedSlugs : []);
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

  // Debug instrumentation (§4 batterie de référence) — requiert isAdmin serveur ET body.debug === true.
  // Un client non-admin qui envoie debug: true n'obtient JAMAIS le bloc debug.
  const debugRequested = body?.debug === true;

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
  // Les admins ont une allocation illimitée (999999) ; anonyme = 5, inscrit = 10.
  const isAdmin = (credit?.allowed ?? 0) > 10;
  const debugEnabled = isAdmin && debugRequested;
  const debugTrace: any[] = [];

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
  const retrievedSlugs = new Set<string>();
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
        const turnToolUses: any[] = [];
        for (const block of data.content ?? []) {
          if (block.type === "tool_use") {
            const result = await runTool(admin, block.name, block.input ?? {});
            collectSlugs(result, retrievedSlugs);
            if (debugEnabled) {
              turnToolUses.push({ name: block.name, input: block.input ?? {} });
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }
        if (debugEnabled) {
          debugTrace.push({ turn: i, stop_reason: "tool_use", tool_uses: turnToolUses });
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      finalText = (data.content ?? [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
      if (debugEnabled) {
        debugTrace.push({ turn: i, stop_reason: data.stop_reason ?? "end_turn", tool_uses: [] });
      }
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
  const allowed = credit?.allowed ?? (isAnon ? 5 : 10);
  const remainingAfter = Math.max(allowed - usedAfter, 0);

  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    (EdgeRuntime as any).waitUntil(logIntelligence(admin, question, questionRank, conversationKey, finalText, [...retrievedSlugs]));
  }

  return json({
    answer: finalText,
    conversation_key: conversationKey,
    credits: { used: usedAfter, allowed, remaining: remainingAfter },
    // Indice "mur imminent" pour que le front prépare le CTA (sans logguer d'event ici :
    // l'event sera loggé au prochain appel effectivement bloqué).
    wall: remainingAfter <= 0 ? { type: isAnon ? "signup" : "paywall", soft: true } : null,
    ...(debugEnabled ? { debug: { trace: debugTrace } } : {}),
  });
});
