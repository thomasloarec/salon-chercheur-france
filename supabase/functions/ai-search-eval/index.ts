import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_ITERS = 5;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

const TOOLS = [
  {
    name: "rechercher_salons",
    description:
      "Trouve des SALONS pertinents pour un besoin metier exprime en langage naturel. " +
      "`intention` = description du besoin (ex: 'logiciels de gestion pour la restauration'). " +
      "`pour_visiter` = true si l'utilisateur veut VISITER un salon, ne renvoie que des salons dont une edition est A VENIR. " +
      "`pour_visiter` = false s'il cherche ou EXPOSER, renvoie aussi les salons du domaine dont la prochaine edition n'est pas encore annoncee " +
      "(champs `a_venir` et `prochaine_date` par salon). " +
      "Chaque salon renvoie: salon_label, ville via les instances, nb_exposants_matchants (densite), prochaine_date, a_venir, " +
      "instances_a_venir (editions a venir avec ville/date/slug) et exemples_exposants.",
    input_schema: {
      type: "object",
      properties: {
        intention: { type: "string", description: "Le besoin/theme en langage naturel." },
        pour_visiter: { type: "boolean", description: "true = visiter (a venir seulement) ; false = exposer (tout l'historique + prochaine date)." },
      },
      required: ["intention", "pour_visiter"],
    },
  },
  {
    name: "identifier_entreprise",
    description:
      "Resout un NOM d'entreprise OU un site/domaine vers un identifiant exposant. " +
      "A appeler EN PREMIER pour toute question 'ou expose [entreprise]'. " +
      "Renvoie des candidats avec `methode` (domaine/nom_exact/nom_approx), `score`, et `expose_bientot` (l'entreprise a-t-elle une presence sur un salon a venir). " +
      "Si plusieurs candidats a score eleve (doublons de fiches), demande a l'utilisateur de preciser, ou combine leurs salons.",
    input_schema: {
      type: "object",
      properties: { nom_ou_site: { type: "string", description: "Nom d'entreprise ou domaine/URL." } },
      required: ["nom_ou_site"],
    },
  },
  {
    name: "salons_d_une_entreprise",
    description:
      "Liste les salons d'une entreprise via son `exhibitor_id` (obtenu par identifier_entreprise). " +
      "`seulement_a_venir` = true par defaut. Renvoie nom_event, ville, date_debut, date_fin, stand_exposant (numero de stand), a_venir.",
    input_schema: {
      type: "object",
      properties: { exhibitor_id: { type: "string" }, seulement_a_venir: { type: "boolean" } },
      required: ["exhibitor_id"],
    },
  },
  {
    name: "rechercher_entreprises",
    description:
      "Trouve des ENTREPRISES exposantes proches d'un theme. Usage principal = REPLI : " +
      "quand un concurrent nomme n'expose sur aucun salon a venir (expose_bientot=false), cherche ici des entreprises similaires " +
      "qui, elles, exposent bientot, en passant `seulement_a_venir=true`. " +
      "`intention` = theme ou description de l'activite du concurrent. Chaque resultat renvoie ses salons a venir dans `salons`.",
    input_schema: {
      type: "object",
      properties: { intention: { type: "string" }, seulement_a_venir: { type: "boolean" } },
      required: ["intention", "seulement_a_venir"],
    },
  },
  {
    name: "exposants_d_un_salon",
    description:
      "Donne les EXPOSANTS et les CATEGORIES d'un salon precis, identifie par son nom ou son slug (ex: 'SPACE'). " +
      "SANS `sous_secteur` : renvoie nb_exposants (total), categories_macro (repartition par grande categorie), " +
      "categories_sous_secteurs (repartition fine, top 20) et echantillon_exposants (quelques noms). " +
      "AVEC `sous_secteur` (un nom issu de categories_sous_secteurs) : renvoie la liste des exposants de cette categorie au salon, avec leur stand. " +
      "A utiliser pour toute question 'quels exposants / quelles categories au salon X'.",
    input_schema: {
      type: "object",
      properties: {
        salon: { type: "string", description: "Nom ou slug du salon (ex: 'SPACE' ou 'space')." },
        sous_secteur: { type: "string", description: "Optionnel. Nom d'un sous-secteur pour lister ses exposants au salon." },
      },
      required: ["salon"],
    },
  },
  {
    name: "rechercher_salons_catalogue",
    description:
      "Recherche dans le CATALOGUE complet des salons (479), y compris ceux dont Lotexpo ne connait pas encore les exposants. " +
      "A utiliser dans TROIS cas : (a) rechercher_salons ne renvoie rien ou rien de pertinent ; " +
      "(b) la question comporte une VILLE ; (c) la question comporte une periode ou une echeance. " +
      "`sujet` est optionnel : si la question ne porte que sur un lieu (ex: 'salons a Lille'), laisse-le vide et renseigne `ville`. " +
      "Renvoie DEUX tableaux distincts qu'il ne faut jamais fusionner : `salons_exploitables` (recommandables) " +
      "et `salons_peu_couverts` (existants mais sans liste d'exposants sur Lotexpo). Voir la regle dediee dans les instructions.",
    input_schema: {
      type: "object",
      properties: {
        sujet: { type: "string", description: "Optionnel. Theme ou besoin metier. Laisser vide pour une recherche purement geographique." },
        ville: { type: "string", description: "Optionnel. Nom de ville (ex: 'Lille', 'Paris')." },
        pour_visiter: { type: "boolean", description: "true = editions a venir seulement (defaut). false = tout l'historique." },
        avant_le: { type: "string", description: "Optionnel. Date ISO (AAAA-MM-JJ) : ne renvoie que les salons commencant avant cette date. Utile pour 'cet automne', 'avant decembre'." },
      },
      required: [],
    },
  },
];

function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Tu es l'assistant de recherche de Lotexpo, plateforme des salons professionnels français. Tu aides un visiteur à trouver LES BONS salons et exposants pour son besoin. Date du jour : ${today}.

RÈGLES ABSOLUES (ne jamais enfreindre) :
- Tu ne connais QUE ce que les outils te renvoient. N'invente jamais un salon, une entreprise, une date ou un stand qui n'apparaît pas dans un résultat d'outil.
- Ne recommande JAMAIS à un visiteur un salon déjà passé. Un salon n'est recommandable pour une VISITE que s'il a une édition à venir (a_venir = true / présence dans instances_a_venir).
- Si le résultat est mince (peu ou pas d'exposants pertinents sur des salons à venir), DIS-LE honnêtement plutôt que de gonfler une réponse. Ex : « Peu d'exposants de ce domaine exposent d'ici la fin de l'année ; le plus proche est X (ville, date). »
- Ne fabrique jamais une fausse impression de certitude. Une réponse honnête et partielle vaut mieux qu'une réponse plausible mais fausse.
- Ne renvoie JAMAIS le visiteur hors de Lotexpo. Aucun lien, aucune adresse, aucune recommandation vers un site officiel de salon, un site d'exposant, un organisateur, un moteur de recherche, des archives ou une source de presse. Cela vaut même quand Lotexpo couvre mal le sujet, même quand tu n'as pas la réponse, et même si l'information existe évidemment ailleurs. Dans ce cas, dis honnêtement ce que tu ne sais pas et propose ce que Lotexpo couvre bien.

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

QUEL OUTIL POUR TROUVER DES SALONS :
- Par défaut : rechercher_salons. Il classe par densité d'exposants du domaine, c'est la meilleure réponse quand la donnée est là.
- Appelle rechercher_salons_catalogue quand : rechercher_salons ne renvoie rien ou rien de pertinent ; OU la question comporte une VILLE ; OU la question comporte une période ou une échéance (« cet automne », « avant décembre »). Dans ce dernier cas, calcule la date à partir de la date du jour et passe-la dans avant_le.
- Pour une question purement géographique (« salons à Lille »), appelle rechercher_salons_catalogue en laissant sujet vide et en renseignant ville.
- Tu peux appeler les deux outils et combiner leurs résultats, en respectant la règle des deux tableaux ci-dessous.

SALONS PEU COUVERTS — RÈGLE DE RECOMMANDATION :
- rechercher_salons_catalogue renvoie DEUX tableaux qui n'ont pas le même statut. Ne les fusionne jamais.
- salons_exploitables : Lotexpo connaît assez d'exposants pour que la page du salon soit utile au visiteur. Ce sont les SEULS que tu recommandes. Présente-les en premier, avec leur lien.
- salons_peu_couverts : ces salons existent et correspondent au sujet, mais Lotexpo n'en référence pas encore assez d'exposants pour en dire quoi que ce soit d'utile. Tu peux les CITER brièvement, APRÈS les exploitables, pour ne pas laisser croire qu'ils n'existent pas, en précisant que leur liste d'exposants n'est pas encore disponible sur Lotexpo.
- Ne recommande JAMAIS un salon peu couvert. Ne le place jamais avant un exploitable. N'explique JAMAIS pourquoi sa donnée manque : tu ne le sais pas.
- Ne renvoie JAMAIS le visiteur vers un site externe, un site officiel de salon, un organisateur ou une source de presse, même quand Lotexpo couvre mal le sujet. Si seuls des salons peu couverts correspondent, dis-le et propose les salons exploitables les plus proches du besoin.

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
- N'INVENTE JAMAIS un slug. Si un résultat n'a pas de slug ou de public_slug, cite l'élément par son nom, SANS lien. Ne le remplace jamais par une autre cible.
- N'utilise JAMAIS le champ website, site, url ou domaine d'un résultat d'outil comme cible de lien. Ces champs servent à identifier une entreprise, jamais à la lier. Le seul lien valide pour un exposant est /exposants/{public_slug}. Écrire [NIBELIS](https://www.nibelis.fr) est une FAUTE : il faut [NIBELIS](/exposants/nibelis), ou le nom sans lien si public_slug est absent.
- Tout lien commence OBLIGATOIREMENT par une barre oblique. /events/space et /exposants/nibelis sont corrects. events/space et exposants/nibelis sont FAUX et produisent des liens cassés chez le visiteur. Jamais d'URL absolue, jamais de lien sans barre oblique initiale.

STYLE : français, B2B, concis et actionnable. Pour chaque salon recommandé : nom, ville, date, POURQUOI (ex. « ~X exposants du domaine »), et 1-2 exposants en exemple. Pas de blabla, pas de superlatifs creux. Termine par une réponse claire, pas une liste d'outils.`;
}

async function callRpc(admin: any, fn: string, args: any) {
  for (let a = 0; a < 2; a++) {
    const { data, error } = await admin.rpc(fn, args);
    if (!error) return data;
    if (a === 0) { await new Promise((r) => setTimeout(r, 400)); continue; }
    return { error: error.message };
  }
}

async function runTool(admin: any, name: string, input: any) {
  try {
    if (name === "rechercher_salons")
      return await callRpc(admin, "match_salons_semantic", { p_query: String(input.intention ?? ""), p_k: 12, p_upcoming_only: input.pour_visiter ?? true, p_min_sim: 0.48 });
    if (name === "identifier_entreprise")
      return await callRpc(admin, "resolve_exhibitor", { p_query: String(input.nom_ou_site ?? ""), p_k: 5 });
    if (name === "salons_d_une_entreprise")
      return await callRpc(admin, "get_exhibitor_salons", { p_exhibitor_id: String(input.exhibitor_id ?? ""), p_upcoming_only: input.seulement_a_venir ?? true });
    if (name === "rechercher_entreprises")
      return await callRpc(admin, "match_exhibitors_global", { p_query: String(input.intention ?? ""), p_threshold: 0.32, p_k: 20, p_upcoming_only: input.seulement_a_venir ?? true });
    if (name === "exposants_d_un_salon")
      return await callRpc(admin, "exposants_d_un_salon", { p_salon: String(input.salon ?? ""), p_sous_secteur: input.sous_secteur ? String(input.sous_secteur) : null });
    if (name === "rechercher_salons_catalogue") {
      const sujet = String(input.sujet ?? "").trim();
      const ville = String(input.ville ?? "").trim();
      return await callRpc(admin, "match_events_semantic", { p_query: sujet.length > 0 ? sujet : null, p_ville: ville.length > 0 ? ville : null, p_upcoming_only: input.pour_visiter ?? true, p_date_max: input.avant_le ? String(input.avant_le) : null, p_threshold: 0.32, p_k: 12 });
    }
    return { error: "outil inconnu" };
  } catch (e) { return { error: String(e).slice(0, 300) }; }
}

function extractEventSlugs(t: string): string[] {
  const s = new Set<string>(); const re = /\/events\/([a-z0-9-]+)/gi; let m;
  while ((m = re.exec(t)) !== null) s.add(m[1].toLowerCase());
  return [...s];
}
function countExhibitorLinks(t: string): number {
  const s = new Set<string>(); const re = /\/exposants\/([a-z0-9-]+)/gi; let m;
  while ((m = re.exec(t)) !== null) s.add(m[1].toLowerCase());
  return s.size;
}
function collectSlugs(node: any, acc: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const v of node) collectSlugs(v, acc); return; }
  for (const [k, v] of Object.entries(node)) {
    if (k === "slug" && typeof v === "string" && v) acc.add(v.toLowerCase());
    else collectSlugs(v, acc);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_body" }, 400); }

  const model = String(body?.model ?? "claude-haiku-4-5-20251001");
  const question = String(body?.question ?? "").trim();
  const caseId = String(body?.case_id ?? "sans_id");
  const runLabel = String(body?.run_label ?? "adhoc");
  const attempt = Number(body?.attempt ?? 1);
  if (!question) return json({ error: "question_vide" }, 400);

  const t0 = Date.now();
  const messages: any[] = [{ role: "user", content: question }];
  const retrieved = new Set<string>();
  const toolCalls: any[] = [];
  let finalText = ""; let iters = 0; let inTok = 0; let outTok = 0; let err: string | null = null;

  try {
    for (let i = 0; i < MAX_ITERS; i++) {
      iters = i + 1;
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1500, system: systemPrompt(), tools: TOOLS, messages }),
      });
      if (!resp.ok) { err = "anthropic_" + resp.status + "_" + (await resp.text()).slice(0, 200); break; }
      const data = await resp.json();
      inTok += data.usage?.input_tokens ?? 0;
      outTok += data.usage?.output_tokens ?? 0;
      messages.push({ role: "assistant", content: data.content });

      if (data.stop_reason === "tool_use") {
        const results: any[] = [];
        for (const b of data.content ?? []) {
          if (b.type === "tool_use") {
            const r = await runTool(admin, b.name, b.input ?? {});
            collectSlugs(r, retrieved);
            const n = Array.isArray(r) ? r.length : (r && typeof r === "object" ? 1 : 0);
            toolCalls.push({ turn: i, name: b.name, input: b.input ?? {}, n_results: n, error: (r as any)?.error ?? null });
            results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(r) });
          }
        }
        messages.push({ role: "user", content: results });
        continue;
      }
      finalText = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      break;
    }
  } catch (e) { err = String(e).slice(0, 300); }

  const row = {
    run_label: runLabel, model, case_id: caseId, question, attempt,
    tool_calls: toolCalls, n_iters: iters, final_text: finalText,
    cited_event_slugs: extractEventSlugs(finalText),
    retrieved_event_slugs: [...retrieved],
    cited_exhibitor_count: countExhibitorLinks(finalText),
    latency_ms: Date.now() - t0, input_tokens: inTok, output_tokens: outTok, error: err,
  };
  await admin.from("ai_eval_runs").insert(row);
  return json({ ok: true, case_id: caseId, model, tools: toolCalls.map((t) => t.name), error: err });
});
