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
    if (name === "fiche_salon")
      return await callRpc(admin, "fiche_salon", { p_salon: String(input.nom ?? "") });
    if (name === "salons_des_concurrents")
      return await callRpc(admin, "salons_des_concurrents", { p_nom_ou_site: String(input.entreprise ?? "") });
    if (name === "identifier_entreprise")
      return await callRpc(admin, "resolve_exhibitor", { p_query: String(input.nom_ou_site ?? ""), p_k: 5 });
    if (name === "salons_d_une_entreprise")
      return await callRpc(admin, "get_exhibitor_salons", { p_exhibitor_id: String(input.exhibitor_id ?? ""), p_upcoming_only: input.seulement_a_venir ?? true });
    if (name === "rechercher_entreprises")
      return await callRpc(admin, "match_exhibitors_global", { p_query: String(input.intention ?? ""), p_threshold: 0.32, p_k: 20, p_upcoming_only: input.seulement_a_venir ?? true });
    if (name === "exposants_d_un_salon")
      return await callRpc(admin, "exposants_d_un_salon", { p_salon: String(input.salon ?? ""), p_sous_secteur: input.sous_secteur ? String(input.sous_secteur) : null });
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
function hasExternalLink(t: string): boolean {
  return /\]\(https?:\/\//i.test(t) || /\bhttps?:\/\/(?!lotexpo\.com)/i.test(t);
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
    latency_ms: Date.now() - t0, input_tokens: inTok, output_tokens: outTok,
    error: err ?? (hasExternalLink(finalText) ? "LIEN_EXTERNE_DETECTE" : null),
  };
  await admin.from("ai_eval_runs").insert(row);
  return json({ ok: true, case_id: caseId, model, tools: toolCalls.map((t) => t.name), lien_externe: hasExternalLink(finalText), error: err });
});
