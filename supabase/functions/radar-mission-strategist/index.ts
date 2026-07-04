import { createClient } from "npm:@supabase/supabase-js@2";
import { callAnthropic, getAnthropicModelStrong } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REL_STATUSES = [
  "client_actif", "client_dormant", "prospect_chaud",
  "prospect_froid", "ancien_client", "a_qualifier",
];
const NEXT_STATUS = [...REL_STATUSES, "ignore", "add_crm"];

type Status = string;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripFences(s: string): string {
  const t = s.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

// ── Scaffold déterministe : objectif + intentions par statut ──────────────────
const OBJECTIVE: Record<Status, string> = {
  a_qualifier: "Confirmer si l'entreprise est pertinente et identifier le bon interlocuteur.",
  prospect_froid: "Détecter un sujet exploitable et obtenir le propriétaire interne.",
  prospect_chaud: "Valider le projet et décrocher la prochaine étape concrète.",
  client_actif: "Détecter satisfaction, expansion et risque fournisseur.",
  client_dormant: "Comprendre la raison du sommeil et une condition de réactivation.",
  ancien_client: "Comprendre la cause de perte et une condition de winback.",
};

const INTENTS: Record<Status, { q1: string; q2: string; q3: string }> = {
  a_qualifier: { q1: "fit / activité", q2: "problème potentiel", q3: "bon contact" },
  prospect_froid: { q1: "contexte / process actuel", q2: "douleur / déclencheur", q3: "propriétaire du sujet" },
  prospect_chaud: { q1: "projet en cours", q2: "critères de décision", q3: "prochaine étape / RDV" },
  client_actif: { q1: "usage actuel", q2: "évolution / nouveau besoin", q3: "action / projet à venir" },
  client_dormant: { q1: "situation actuelle", q2: "raison de l'arrêt", q3: "condition de retour" },
  ancien_client: { q1: "ce qui a changé", q2: "friction passée", q3: "condition future" },
};

const NEXT_BY_STATUS: Record<Status, string> = {
  a_qualifier: "prospect_froid",
  prospect_froid: "prospect_chaud",
  prospect_chaud: "prospect_chaud",
  client_actif: "client_actif",
  client_dormant: "prospect_chaud",
  ancien_client: "prospect_froid",
};

function normStatus(s: unknown): Status {
  return typeof s === "string" && REL_STATUSES.includes(s) ? s : "a_qualifier";
}

// Fallback templates (sans IA). Restent utiles, jamais des placeholders vides.
// IMPORTANT : ne JAMAIS injecter le texte brut de `problem` (souvent une phrase
// entière) au milieu d'un gabarit — cela casse la syntaxe. On reste générique
// mais grammaticalement correct : c'est l'IA qui apporte la spécificité.
function fallbackFields(status: Status, ctx: any) {
  const name = (ctx?.company?.company_name ?? "cette entreprise").toString();
  const intents = INTENTS[status] ?? INTENTS.a_qualifier;
  const roleCheck =
    `Vous êtes plutôt sur quelle partie du sujet chez ${name} : commercial, technique, achats, direction, marketing, opérations… ?`;
  const q3generic =
    `Qui serait la bonne personne pour voir si ce sujet mérite un échange après le salon ?`;
  const bank: Record<Status, { objective: string; opening_line: string; q1: string; q2: string; q3: string }> = {
    a_qualifier: {
      objective: `Confirmer si ${name} est pertinent pour votre domaine et repérer le bon interlocuteur.`,
      opening_line: `Bonjour, je découvre votre stand — je travaille avec des acteurs de votre secteur sur des sujets proches des vôtres.`,
      q1: `Sur quel type d'activité ${name} est plutôt positionné aujourd'hui ?`,
      q2: `Est-ce que ce type de sujet vous parle comme enjeu en ce moment ?`,
      q3: q3generic,
    },
    prospect_froid: {
      objective: `Détecter si ${name} a un enjeu sur votre domaine et repérer qui porte le sujet en interne.`,
      opening_line: `Bonjour, je découvre votre stand — je travaille avec des acteurs de votre secteur sur des sujets proches des vôtres.`,
      q1: `Aujourd'hui, comment gérez-vous ce type de sujet chez ${name} ?`,
      q2: `Quand ça coince, l'impact est plutôt coût, délai, qualité ou charge des équipes ?`,
      q3: q3generic,
    },
    prospect_chaud: {
      objective: `Valider si le projet est toujours actif chez ${name} et décrocher la prochaine étape.`,
      opening_line: `Bonjour, on avait échangé sur le sujet — je voulais voir où en sont les choses chez vous.`,
      q1: `Le projet est-il toujours d'actualité chez ${name}, ou les priorités ont bougé ?`,
      q2: `Sur quoi se joue surtout la décision aujourd'hui : budget, timing, ou choix technique ?`,
      q3: `Quelle serait la prochaine étape concrète — un point après le salon avec la bonne personne ?`,
    },
    client_actif: {
      objective: `Mesurer la satisfaction de ${name}, repérer une extension et un éventuel risque fournisseur.`,
      opening_line: `Bonjour, on travaille déjà avec certaines de vos équipes — je passais voir vos priorités cette année.`,
      q1: `Comment ça se passe côté usage actuel chez ${name} ?`,
      q2: `Y a-t-il un nouveau besoin ou une évolution qui monte de votre côté ?`,
      q3: `Qui pilote les projets à venir sur ce périmètre chez vous ?`,
    },
    client_dormant: {
      objective: `Comprendre pourquoi la relation avec ${name} s'est mise en sommeil et trouver une condition de réactivation.`,
      opening_line: `Bonjour, on a déjà collaboré — je voulais comprendre ce qui a évolué chez vous depuis.`,
      q1: `Où en êtes-vous aujourd'hui chez ${name} sur ce type de sujet ?`,
      q2: `Qu'est-ce qui avait fait qu'on ne travaillait plus ensemble ?`,
      q3: `Qu'est-ce qui pourrait justifier de reprendre le sujet cette année ?`,
    },
    ancien_client: {
      objective: `Comprendre la cause de perte chez ${name} et repérer une condition de winback.`,
      opening_line: `Bonjour, on a travaillé ensemble par le passé — je voulais voir ce qui a changé chez vous depuis.`,
      q1: `Qu'est-ce qui a évolué dans votre organisation sur ce type de sujet ?`,
      q2: `Aujourd'hui, vous êtes équipés avec qui, et qu'est-ce qui coince ?`,
      q3: `Y aurait-il une porte d'entrée pour retravailler ensemble ?`,
    },
  };
  const f = bank[status] ?? bank.a_qualifier;
  return {
    objective: f.objective,
    opening_line: f.opening_line,
    q0_role_check: roleCheck,
    top_q1: f.q1,
    top_q2: f.q2,
    top_q3: f.q3,
    question_intents: intents,
  };
}

// ── Score de confiance déterministe (0–100) ──────────────────────────────────
const V2_BLOCKS = [
  "offer_archetype", "problems_solved", "business_outcomes",
  "personas", "target_segments",
];

function hasVal(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

function scoreConfidence(ctx: any) {
  const op = ctx?.offer_profile ?? {};
  const v2 = op.profile_v2 ?? {};
  let score = 0;
  const missing: string[] = [];

  if (hasVal(op.sells) && hasVal(op.target) && hasVal(op.problem) && hasVal(op.qualifies)) score += 25;

  let v2pts = 0;
  for (const b of V2_BLOCKS) {
    if (hasVal(v2?.[b])) v2pts += 6;
    else missing.push(b);
  }
  score += Math.min(30, v2pts);

  const desc = (ctx?.company?.description ?? "").toString().trim();
  if (desc.length > 20) score += 20;

  if (hasVal(ctx?.relationship_status)) score += 15;
  if (hasVal(ctx?.event?.secteur)) score += 10;

  score = Math.max(0, Math.min(100, score));
  const band = score < 40 ? "faible" : score < 70 ? "moyen" : "fort";
  return { score, band, missing };
}

// ── System prompt Anthropic ───────────────────────────────────────────────────
const SYSTEM = `Tu es un directeur commercial senior (20 ans d'expérience), expert de la découverte terrain en salon B2B. Ta mission n'est PAS d'aider à pitcher, mais d'obtenir l'information qui rendra le prochain échange bien plus fort.

Règles strictes :
1. Réponds UNIQUEMENT par un objet JSON valide. Aucune prose, aucune fence markdown.
2. Respecte l'objectif et les 3 intentions fournis par le scaffold. Le TOP 3 suit l'ordre contexte -> enjeu -> décision/contact.
3. Formule TOUJOURS en hypothèses prudentes : "Le sujet est-il plutôt porté par… ?", "Chez vous, est-ce plutôt… ?", "Qui serait la bonne personne pour… ?". Le tentatif invite la correction et évite d'affirmer un fait non vérifié.
4. Chaque question fait le pont entre l'offre de l'utilisateur (profil) et CETTE entreprise (description/secteur). Interdiction de questions génériques.
5. Banlist absolue (jamais générées) : "Pouvez-vous me parler de votre entreprise ?", "Êtes-vous intéressé par notre solution ?", "Avez-vous un budget ?".
6. Français, ton professionnel, questions courtes lisibles sur mobile (<= ~140 caractères).
7. La personne rencontrée n'est souvent PAS le décideur : privilégie les questions qui cartographient (qui porte le sujet, qui recontacter) plutôt que le closing.

CALIBRAGE SELON L'EXPOSANT (prioritaire) :

Avant de rédiger, évalue la taille et la structure probable de l'entreprise exposante à partir de son nom, de sa description et du salon. Déduis qui tient réellement le stand et ce qu'il peut répondre. Le statut relationnel définit l'objectif stratégique ; la taille de l'exposant définit ce qui est réellement atteignable au stand.

- Grand groupe / multinationale / organisation multi-sites : le stand est presque toujours tenu par des profils commerciaux, marketing ou communication. Ils NE connaissent PAS les détails techniques d'un produit de niche ni l'historique d'une relation fournisseur. Quel que soit le statut relationnel, la première étape réaliste au stand est d'IDENTIFIER et d'ATTEINDRE le bon interlocuteur interne — l'info spécifique au statut (historique, projet, spec) se récupère ensuite auprès de cette personne. Génère des questions de cartographie / routage : qui pilote ce sujet en interne, comment c'est organisé (siège / région / site), quel est le bon point d'entrée pour la partie technique ou achats, comment obtenir ce contact. N'exige JAMAIS de cet interlocuteur qu'il se souvienne d'une spec ou d'un historique de collaboration.

- ETI : profondeur partielle. Mélange une question de cartographie et une question plus concrète.

- PME / startup : le stand connaît souvent le produit et l'organisation ; questions techniques ou business directes permises.

- En cas de doute : une question de cartographie + une question qui fonctionne quel que soit l'interlocuteur, plutôt que des questions supposant une expertise pointue.

Exemplars :

- PME/ETI industrielle, prospect_froid, offre = capteurs — BON : « Chez vous, le choix des capteurs est plutôt piloté par le bureau d'études, la production ou les achats ? »

- Grand groupe multi-sites, client_dormant, offre = capteurs — BON : « Qui pilote aujourd'hui les sujets capteurs / instrumentation chez vous, au siège ou par site ? » ; « Quel serait le bon point d'entrée technique pour reprendre le fil ? » — MAUVAIS : « Êtes-vous encore sur nos capteurs Reed ou avez-vous changé ? » (le commercial du stand d'un grand groupe ne le sait pas).

Schéma JSON EXACT à retourner :
{"objective":"…","opening_line":"…","q0_role_check":"…","top_q1":"…","top_q2":"…","top_q3":"…","question_intents":{"q1":"…","q2":"…","q3":"…"},"exhibitor_scale":"grand_groupe|eti|pme|incertain","capture_fields":["…"],"success_condition":"…","recommended_next_status":"prospect_froid","follow_up_task":"…"}`;

function buildUserPrompt(ctx: any, status: Status, scaffoldObjective: string, intents: any) {
  const banlist = [
    "Pouvez-vous me parler de votre entreprise ?",
    "Êtes-vous intéressé par notre solution ?",
    "Avez-vous un budget ?",
  ];
  const payload = {
    offer_profile: ctx?.offer_profile ?? null,
    company: ctx?.company ?? null,
    event: ctx?.event ?? null,
    relationship_status: status,
    scaffold_objective: scaffoldObjective,
    question_intents: intents,
    banlist,
  };
  return `Contexte et scaffold (à respecter) :\n${JSON.stringify(payload)}\n\nRédige la sortie JSON en respectant strictement l'objectif scaffold et l'intention de chaque question (Q1=${intents.q1}, Q2=${intents.q2}, Q3=${intents.q3}).`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "missing_authorization" }, 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 422);
    }
    const crmCompanyId = body?.crm_company_id;
    const eventId = body?.event_id;
    const force = body?.force === true;
    if (typeof crmCompanyId !== "string" || !UUID_RE.test(crmCompanyId) ||
        typeof eventId !== "string" || !UUID_RE.test(eventId)) {
      return json({ error: "invalid_body", detail: "crm_company_id and event_id must be UUIDs" }, 422);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // Client user-JWT : auth.uid() résolu dans les RPC (PAS de service_role).
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    // Contexte scopé import actif (règle d'or) via RPC SECURITY DEFINER.
    const { data: ctx, error: ctxErr } = await supabase.rpc("get_radar_mission_context", {
      p_crm_company_id: crmCompanyId,
      p_event_id: eventId,
    });
    if (ctxErr) {
      const msg = (ctxErr.message || "").toLowerCase();
      if (msg.includes("no_access") || msg.includes("not_authenticated")) return json({ error: "forbidden" }, 403);
      if (msg.includes("out_of_scope") || msg.includes("company_not_found")) return json({ error: "not_found" }, 404);
      console.error("[strategist] ctx error:", ctxErr.message);
      return json({ error: "context_error" }, 400);
    }

    const status = normStatus(ctx?.relationship_status);
    const scaffoldObjective = OBJECTIVE[status] ?? OBJECTIVE.a_qualifier;
    const intents = INTENTS[status] ?? INTENTS.a_qualifier;
    const conf = scoreConfidence(ctx);
    const fb = fallbackFields(status, ctx);

    const model = getAnthropicModelStrong();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    let generator = "scaffold";
    let fallbackReason = "none";
    let out: any = { ...fb };
    let aiExtra: any = {};

    if (!apiKey) {
      fallbackReason = "no_api_key";
      console.error("[strategist] no ANTHROPIC_API_KEY -> scaffold");
    } else {
      const res = await callAnthropic({
        apiKey,
        model,
        system: SYSTEM,
        userMessage: buildUserPrompt(ctx, status, scaffoldObjective, intents),
        maxTokens: 700,
        caller: "mission-strategist",
      });
      if (res.ok && res.text) {
        try {
          const parsed = JSON.parse(stripFences(res.text));
          const ok = ["objective", "opening_line", "top_q1", "top_q2", "top_q3"]
            .every((k) => typeof parsed?.[k] === "string" && parsed[k].trim().length > 0);
          if (ok) {
            generator = "ai";
            fallbackReason = "none";
            out = {
              objective: parsed.objective.trim(),
              opening_line: parsed.opening_line.trim(),
              q0_role_check: (parsed.q0_role_check ?? fb.q0_role_check).toString(),
              top_q1: parsed.top_q1.trim(),
              top_q2: parsed.top_q2.trim(),
              top_q3: parsed.top_q3.trim(),
              question_intents: parsed.question_intents ?? intents,
            };
            aiExtra = {
              capture_fields: Array.isArray(parsed.capture_fields) ? parsed.capture_fields : undefined,
              success_condition: typeof parsed.success_condition === "string" ? parsed.success_condition : undefined,
              recommended_next_status: NEXT_STATUS.includes(parsed.recommended_next_status)
                ? parsed.recommended_next_status : undefined,
              follow_up_task: typeof parsed.follow_up_task === "string" ? parsed.follow_up_task : undefined,
            };
          } else {
            fallbackReason = "missing_fields";
            console.error("[strategist] AI JSON missing required fields -> scaffold");
          }
        } catch {
          fallbackReason = "parse_error";
          console.error("[strategist] AI parse failed -> scaffold");
        }
      } else {
        fallbackReason = `ai_error:${res.errorCode ?? "unknown"}`;
        console.error("[strategist] AI call failed -> scaffold:", res.errorCode);
      }
    }

    const aiMeta = {
      q0_role_check: out.q0_role_check,
      question_intents: out.question_intents ?? intents,
      capture_fields: aiExtra.capture_fields ?? ["owner", "current_supplier", "timing", "pain", "next_step"],
      success_condition: aiExtra.success_condition ??
        "Identifier le bon interlocuteur et une prochaine étape concrète.",
      recommended_next_status: aiExtra.recommended_next_status ?? (NEXT_BY_STATUS[status] ?? "prospect_chaud"),
      follow_up_task: aiExtra.follow_up_task ?? "Envoyer une information courte et ciblée après le salon.",
      confidence_score: conf.score,
      confidence_band: conf.band,
      missing_profile_fields: conf.missing,
      model,
      generator,
      fallback_reason: fallbackReason,
    };

    const { data: missionId, error: applyErr } = await supabase.rpc("apply_radar_mission_strategy", {
      p_crm_company_id: crmCompanyId,
      p_event_id: eventId,
      p_objective: out.objective,
      p_opening_line: out.opening_line,
      p_top_q1: out.top_q1,
      p_top_q2: out.top_q2,
      p_top_q3: out.top_q3,
      p_ai_meta: aiMeta,
      p_force: force,
    });
    if (applyErr) {
      const msg = (applyErr.message || "").toLowerCase();
      if (msg.includes("no_access")) return json({ error: "forbidden" }, 403);
      if (msg.includes("out_of_scope") || msg.includes("company_not_found")) return json({ error: "not_found" }, 404);
      console.error("[strategist] apply error:", applyErr.message);
      return json({ error: "persist_error" }, 400);
    }

    console.log(`[strategist] ok mission=${missionId} generator=${generator} conf=${conf.score} ${Date.now() - t0}ms`);

    return json({
      mission_id: missionId,
      objective: out.objective,
      opening_line: out.opening_line,
      top_q1: out.top_q1,
      top_q2: out.top_q2,
      top_q3: out.top_q3,
      ai_meta: aiMeta,
    });
  } catch (e) {
    console.error("[strategist] fatal:", e instanceof Error ? e.message : String(e));
    return json({ error: "internal_error" }, 500);
  }
});