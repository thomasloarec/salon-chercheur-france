import { createClient } from 'npm:@supabase/supabase-js@2';
import { ANTHROPIC_API_URL, buildAnthropicHeaders } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// `prepare-visit` intentionally uses Haiku (fast + cheap, suitable for short
// reasoning over a pre-filtered shortlist of exhibitors). It does NOT use the
// shared default Sonnet model.
const PREPARE_VISIT_MODEL = "claude-haiku-4-5-20251001";

// Duration → exhibitor caps
const DURATION_CAPS: Record<string, { total: number; high: number; medium: number }> = {
  "2h": { total: 10, high: 6, medium: 4 },
  "Demi-journée": { total: 20, high: 12, medium: 8 },
  "Journée complète": { total: 30, high: 18, medium: 12 },
};

// Recall ceiling: max candidates handed to Claude (distinct from DURATION_CAPS,
// which bounds the FINAL selection Claude returns).
const MAX_CANDIDATES = 60;

// Objective → expected tokens checked against `type_interet` (after norm).
// Covers the 6 visitor objectives. "Rencontrer mes clients et prospects" is the
// seller mode and has no type_interet alignment (see mode logic below).
const OBJECTIVE_TOKENS: Record<string, string[]> = {
  "Trouver de nouveaux fournisseurs": ["fournisseur", "achat"],
  "Comparer des solutions": ["fournisseur", "concurrent", "achat"],
  "Découvrir les innovations du marché": ["veille_techno", "veille"],
  "Faire de la veille concurrentielle": ["concurrent", "veille"],
  "Identifier des partenaires": ["partenariat", "partenaire"],
  // "Rencontrer mes clients et prospects" -> seller mode, no type_interet alignment
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripCodeFences(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

function salvageClaudeResults(rawContent: string): { results: any[] } | null {
  const jsonStr = stripCodeFences(rawContent);
  const resultsKeyIndex = jsonStr.indexOf('"results"');
  const arrayStartIndex = resultsKeyIndex >= 0 ? jsonStr.indexOf("[", resultsKeyIndex) : -1;
  const lastCompleteObjectIndex = jsonStr.lastIndexOf("}");

  if (arrayStartIndex >= 0 && lastCompleteObjectIndex > arrayStartIndex) {
    const objectsChunk = jsonStr
      .slice(arrayStartIndex + 1, lastCompleteObjectIndex + 1)
      .replace(/,\s*$/, "")
      .trim();
    if (objectsChunk) {
      const repairedJson = `{"results":[${objectsChunk}]}`;
      try { return JSON.parse(repairedJson); } catch { /* continue */ }
    }
  }

  const objectMatches = jsonStr.match(
    /\{\s*"exhibitor_id"\s*:\s*"(?:\\.|[^"\\])+"\s*,\s*"raison"\s*:\s*"(?:\\.|[^"\\])*"\s*,\s*"priority"\s*:\s*"(?:high|medium)"\s*\}/g
  ) || [];
  const recoveredResults = objectMatches.flatMap((match) => {
    try { return [JSON.parse(match)]; } catch { return []; }
  });
  return recoveredResults.length > 0 ? { results: recoveredResults } : null;
}

function parseClaudeRecommendations(rawContent: string): { results: any[] } {
  const jsonStr = stripCodeFences(rawContent);
  try { return JSON.parse(jsonStr); } catch { /* continue */ }
  const salvaged = salvageClaudeResults(rawContent);
  if (salvaged) {
    console.warn(`prepare-visit: Claude JSON repaired with ${salvaged.results.length} result(s)`);
    return salvaged;
  }
  throw new Error("Failed to parse AI response");
}

/** Normalize a company name for deduplication: lowercase, trim, collapse whitespace */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Normalize free text: lowercase + strip accents + trim. */
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Coerce any value to a string[] (jsonb arrays may arrive as arrays or null). */
function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

/** Recursively flatten any string leaves out of a jsonb value. */
function flattenStrings(v: any): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(flattenStrings);
  if (v && typeof v === "object") return Object.values(v).flatMap(flattenStrings);
  return [];
}

/** Extract the bare domain (no scheme, no www, no path) from a website URL. */
function extractDomain(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let u = url.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const host = new URL(u).hostname.replace(/^www\./i, "");
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Tokenize user keywords: split by comma, "et", spaces for multi-word expressions.
 * Returns deduplicated lowercase tokens ≥ 3 chars plus original expressions.
 */
function tokenizeKeywords(keywords: string[]): string[] {
  const tokens = new Set<string>();

  for (const raw of keywords) {
    const lower = raw.trim().toLowerCase();
    if (!lower) continue;

    // Keep the full expression
    tokens.add(lower);

    // Split on separators: comma, " et ", " and ", slash
    const parts = lower.split(/[,\/]|\bet\b|\band\b/i);
    for (const part of parts) {
      const cleaned = part.trim();
      if (cleaned.length >= 3) tokens.add(cleaned);

      // Also split individual words ≥ 3 chars
      for (const word of cleaned.split(/\s+/)) {
        if (word.length >= 3) tokens.add(word);
      }
    }
  }

  return [...tokens];
}

// ── AI data fetching ─────────────────────────────────────────────────────────

async function fetchAiRowsInBatches(
  supabase: any,
  ids: string[],
): Promise<Record<string, any>> {
  const aiData: Record<string, any> = {};
  if (ids.length === 0) return aiData;

  const batchSize = 500;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }

  const batchResults = await Promise.all(
    batches.map((batch) =>
      supabase
        .from("exhibitor_ai")
        .select("exhibitor_id, secteur_principal, sous_secteurs, produits_services, mots_cles_metier, profils_visiteurs, type_interet, resume_court")
        .in("exhibitor_id", batch)
        .range(0, 4999),
    ),
  );

  batchResults.forEach(({ data: aiRows }: { data: any[] | null }) => {
    aiRows?.forEach((row: any) => {
      aiData[row.exhibitor_id] = row;
    });
  });

  return aiData;
}

// ── Scoring (recall stage) ────────────────────────────────────────────────────

interface RelevanceMetrics {
  relevance: number;
  matched: number;
  strong: number;
  objectiveAligned: boolean;
  roleInProfils: boolean;
  sectorOverlap: number;
}

/**
 * Compute the recall-stage relevance of an exhibitor for a visitor.
 *
 * - matched: distinct visitor tokens found in the full haystack
 *   (secteur_principal + sous_secteurs + produits_services + mots_cles_metier + resume_court)
 * - strong : distinct visitor tokens found in the strong haystack
 *   (produits_services + mots_cles_metier only)
 * - objectiveAligned: a token expected by the objective is present in type_interet
 *   (always false in seller mode)
 * - roleInProfils: the visitor role token appears in profils_visiteurs
 *   (only used as a tie-breaker, and ignored in seller mode)
 */
function computeRelevance(
  ex: any,
  userTokens: string[],
  roleToken: string,
  expectedObjectiveTokens: string[],
  eventSectorTokens: string[],
  mode: "buyer" | "seller",
): RelevanceMetrics {
  const haystackParts = [
    ex.secteur_principal || "",
    ...toStringArray(ex.sous_secteurs),
    ...toStringArray(ex.produits_services),
    ...toStringArray(ex.mots_cles_metier),
    ex.resume_court || "",
  ];
  const haystack = norm(haystackParts.join(" "));
  const haystackFort = norm(
    [...toStringArray(ex.produits_services), ...toStringArray(ex.mots_cles_metier)].join(" "),
  );

  let matched = 0;
  let strong = 0;
  for (const t of userTokens) {
    if (haystack.includes(t)) matched++;
    if (haystackFort.includes(t)) strong++;
  }

  const typeInteret = toStringArray(ex.type_interet).map(norm);
  const objectiveAligned =
    mode === "seller"
      ? false
      : expectedObjectiveTokens.some((et) =>
          typeInteret.some((ti) => ti.includes(et) || et.includes(ti)),
        );

  const profils = toStringArray(ex.profils_visiteurs).map(norm);
  const roleInProfils = roleToken.length > 0 &&
    profils.some((p) => p.includes(roleToken) || roleToken.includes(p));

  let sectorOverlap = 0;
  for (const st of eventSectorTokens) {
    if (st.length >= 3 && haystack.includes(st)) sectorOverlap++;
  }

  let relevance = matched * 4 + strong * 2;
  if (objectiveAligned) relevance += 2;
  if (mode !== "seller" && roleInProfils) relevance += 1;

  return { relevance, matched, strong, objectiveAligned, roleInProfils, sectorOverlap };
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ── AUTHENTICATION: Validate JWT ────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { eventId, role, objective, keywords, duration } = await req.json();

    if (!eventId || !role || !objective) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── GET EVENT ────────────────────────────────────────────────────────────
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("id, id_event, nom_event, secteur")
      .eq("id", eventId)
      .single();

    if (eventError || !eventData) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── GET ALL PARTICIPATIONS ───────────────────────────────────────────────
    const { data: participations } = await supabase
      .from("participation")
      .select("exhibitor_id, id_exposant, stand_exposant")
      .eq("id_event_text", eventData.id_event)
      .range(0, 1999);

    if (!participations || participations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No exhibitors found", exhibitorCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalParticipations = participations.length;

    // Build stand lookup from participation
    const standByExhibitorId: Record<string, string> = {};
    const standByIdExposant: Record<string, string> = {};
    for (const p of participations) {
      if (p.stand_exposant) {
        if (p.exhibitor_id) standByExhibitorId[p.exhibitor_id] = p.stand_exposant;
        if (p.id_exposant) standByIdExposant[p.id_exposant] = p.stand_exposant;
      }
    }

    // Split modern vs legacy
    const modernIds = participations
      .map((p) => p.exhibitor_id)
      .filter(Boolean) as string[];
    const legacyIds = participations
      .filter((p) => !p.exhibitor_id && p.id_exposant)
      .map((p) => p.id_exposant) as string[];

    // ── FETCH EXHIBITORS (parallel) ──────────────────────────────────────────
    const fetchModernExhibitors = async () => {
      if (modernIds.length === 0) return [] as any[];
      const { data } = await supabase
        .from("exhibitors")
        .select("id, name, description, website, logo_url")
        .in("id", modernIds)
        .range(0, 4999);
      return data || [];
    };

    const fetchLegacyExposants = async () => {
      if (legacyIds.length === 0) return [] as any[];
      const batchSize = 500;
      const batches: string[][] = [];
      for (let i = 0; i < legacyIds.length; i += batchSize) {
        batches.push(legacyIds.slice(i, i + batchSize));
      }
      const results = await Promise.all(
        batches.map((batch) =>
          supabase
            .from("exposants")
            .select("id, id_exposant, nom_exposant, exposant_description, website_exposant")
            .in("id_exposant", batch)
            .range(0, 4999),
        ),
      );
      return results.flatMap(({ data }) => data || []);
    };

    const [modernExhibitors, legacyExhibitors, modernAiData] = await Promise.all([
      fetchModernExhibitors(),
      fetchLegacyExposants(),
      fetchAiRowsInBatches(supabase, modernIds),
    ]);

    const legacyAiData = await fetchAiRowsInBatches(
      supabase,
      legacyExhibitors.map((e) => String(e.id)),
    );
    const aiData = { ...modernAiData, ...legacyAiData };

    // ── MERGE INTO UNIFIED LIST (with intra-legacy dedup by name) ────────────
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const allExhibitors: any[] = [];

    for (const ex of modernExhibitors) {
      if (seenIds.has(ex.id)) continue;
      seenIds.add(ex.id);
      const normalizedName = normalizeName(ex.name || "");
      seenNames.add(normalizedName);
      const ai = aiData[ex.id] || {};
      allExhibitors.push({
        id: ex.id, name: ex.name, description: ex.description || "",
        website: ex.website, logo_url: ex.logo_url,
        stand: standByExhibitorId[ex.id] || null,
        secteur_principal: ai.secteur_principal || null,
        sous_secteurs: ai.sous_secteurs || [],
        produits_services: ai.produits_services || [],
        mots_cles_metier: ai.mots_cles_metier || [],
        profils_visiteurs: ai.profils_visiteurs || [],
        type_interet: ai.type_interet || [],
        resume_court: ai.resume_court || null,
      });
    }

    const legacyBeforeDedup = legacyExhibitors.length;
    let legacySkippedDuplicates = 0;

    for (const ex of legacyExhibitors) {
      const name = (ex.nom_exposant || "").trim();
      if (!name) continue;

      const normalizedName = normalizeName(name);

      if (seenNames.has(normalizedName)) {
        legacySkippedDuplicates++;
        continue;
      }

      const key = `legacy_${ex.id}`;
      if (seenIds.has(key)) continue;

      seenIds.add(key);
      seenNames.add(normalizedName);

      const ai = aiData[String(ex.id)] || {};
      allExhibitors.push({
        id: ex.id_exposant || String(ex.id), name,
        description: ex.exposant_description || "",
        website: ex.website_exposant, logo_url: null,
        stand: standByIdExposant[ex.id_exposant] || null,
        secteur_principal: ai.secteur_principal || null,
        sous_secteurs: ai.sous_secteurs || [],
        produits_services: ai.produits_services || [],
        mots_cles_metier: ai.mots_cles_metier || [],
        profils_visiteurs: ai.profils_visiteurs || [],
        type_interet: ai.type_interet || [],
        resume_court: ai.resume_court || null,
      });
    }

    const totalAnalyzed = allExhibitors.length;
    console.log(
      `📊 prepare-visit: ${totalParticipations} participations, ` +
      `${modernExhibitors.length} modern, ${legacyBeforeDedup} legacy raw, ` +
      `${legacySkippedDuplicates} legacy duplicates removed, ` +
      `${totalAnalyzed} unique exhibitors to score`,
    );

    // ══════ STEP 1: RECALL-STAGE SCORING & CANDIDATE POOL ════════════════════
    const cap = DURATION_CAPS[duration] || DURATION_CAPS["Journée complète"];

    // Offer/demand mode: a "seller" visitor wants exhibitors likely to BUY/INTEGRATE
    // their offer. profils_visiteurs is inverted for them, so role bonus and
    // objective alignment are disabled in seller mode.
    const mode: "buyer" | "seller" =
      objective === "Rencontrer mes clients et prospects" ? "seller" : "buyer";

    const roleToken = norm(role);
    const rawTokens = tokenizeKeywords(keywords || []);
    const userTokens = [...new Set(rawTokens.map(norm).filter((t) => t.length >= 3))];
    const hasKeywords = userTokens.length > 0;
    const expectedObjectiveTokens = (OBJECTIVE_TOKENS[objective] || []).map(norm);
    const eventSectorTokens = [
      ...new Set(flattenStrings(eventData.secteur).map(norm).filter((t) => t.length >= 3)),
    ];

    console.log(`🔑 prepare-visit: mode=${mode}, user tokens = [${userTokens.join(", ")}]`);

    const enriched = allExhibitors.map((ex) => ({
      ...ex,
      _m: computeRelevance(
        ex,
        userTokens,
        roleToken,
        expectedObjectiveTokens,
        eventSectorTokens,
        mode,
      ),
    }));

    let candidatesPool: any[];
    let qualified_count: number;
    let under_threshold: boolean;

    if (hasKeywords) {
      // Hard relevance floor: only exhibitors matching >= 1 keyword qualify.
      const qualified = enriched
        .filter((e) => e._m.matched >= 1)
        .sort((a, b) => b._m.relevance - a._m.relevance);
      qualified_count = qualified.length;
      under_threshold = qualified.length < cap.total;
      // Never pad with non-qualified exhibitors to fill a quota.
      candidatesPool = qualified.slice(0, MAX_CANDIDATES);
    } else {
      // No keywords: no hard floor. Rank by objective alignment, then event-sector
      // overlap, then role match (tie-breaker).
      const ranked = [...enriched].sort((a, b) => {
        const oa = (b._m.objectiveAligned ? 1 : 0) - (a._m.objectiveAligned ? 1 : 0);
        if (oa !== 0) return oa;
        const so = b._m.sectorOverlap - a._m.sectorOverlap;
        if (so !== 0) return so;
        return (b._m.roleInProfils ? 1 : 0) - (a._m.roleInProfils ? 1 : 0);
      });
      qualified_count = enriched.length;
      under_threshold = false;
      candidatesPool = ranked.slice(0, MAX_CANDIDATES);
    }

    // ══════ STEP 2: CLAUDE SELECTS, RANKS & JUSTIFIES ════════════════════════
    const candidates = candidatesPool.map((ex) => ({
      id: ex.id,
      name: ex.name,
      secteur_principal: ex.secteur_principal,
      sous_secteurs: toStringArray(ex.sous_secteurs),
      produits_services: toStringArray(ex.produits_services),
      mots_cles_metier: toStringArray(ex.mots_cles_metier),
      resume_court: ex.resume_court || ex.description || null,
      domain: extractDomain(ex.website),
    }));

    console.log(
      JSON.stringify({
        event: eventData.id_event,
        mode,
        total_charges: totalAnalyzed,
        qualified_count,
        candidates_sent: candidates.length,
        under_threshold,
        top5: candidatesPool.slice(0, 5).map((e) => ({ name: e.name, relevance: e._m.relevance })),
      }),
    );

    if (candidates.length === 0) {
      console.log("prepare-visit: pool de candidats vide → court-circuit, aucun appel Claude");
      return new Response(JSON.stringify({
        prioritaires: [],
        optionnels: [],
        totalExhibitors: totalParticipations,
        analyzedExhibitors: totalAnalyzed,
        ai_duration_ms: 0,
        mode,
        under_threshold: true,
        qualified_count,
        candidates_sent: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const keywordsDisplay = (keywords || []).join(", ");
    const prompt = `Tu es un expert des salons professionnels B2B qui aide un visiteur à prioriser les exposants à rencontrer.

Profil du visiteur :
- Rôle : ${role}
- Objectif : ${objective}
- Centres d'intérêt (ce qu'il cherche) : ${keywordsDisplay || "non précisés"}
- Temps disponible : ${duration || "non précisé"}
${mode === "seller"
  ? "- IMPORTANT : ce visiteur cherche des exposants susceptibles d'ACHETER ou d'INTÉGRER son offre. Ses centres d'intérêt décrivent ce qu'IL vend, pas ce qu'il veut acheter. Ne retiens que des exposants dont l'activité rend plausible qu'ils soient clients ou intégrateurs de cette offre. En cas de doute, ne l'inclus pas."
  : ""}

Voici les exposants candidats présélectionnés, avec leur activité réelle :
${JSON.stringify(candidates)}

Ta tâche :
1. SÉLECTIONNE uniquement les exposants RÉELLEMENT pertinents pour ce visiteur, au maximum ${cap.total}.
2. Si moins de ${cap.total} exposants sont réellement pertinents au regard de ses centres d'intérêt, RETOURNE-EN MOINS. Ne complète JAMAIS la liste avec des exposants peu pertinents pour atteindre un quota.
3. Marque en "high" les meilleurs (au plus ${cap.high}), les autres exposants pertinents en "medium".
4. Pour chacun, rédige UNE phrase de justification SPÉCIFIQUE et ancrée dans son activité réelle : cite l'élément concret (un produit, un service, un mot-clé métier) qui le rend pertinent pour CE visiteur. Varie les formulations ; n'utilise aucune phrase passe-partout et ne commence pas toutes les phrases de la même manière.
5. N'invente jamais d'information absente des données fournies. Chaque justification doit être propre à l'exposant concerné.

Retourne UNIQUEMENT un JSON valide, sans markdown, sans backtick, sans texte avant ou après :
{"results":[{"exhibitor_id":"...","raison":"...","priority":"high"}]}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    // ★ Track AI duration
    const aiStart = Date.now();

    const aiResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: buildAnthropicHeaders(ANTHROPIC_API_KEY),
      body: JSON.stringify({
        model: PREPARE_VISIT_MODEL,
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const aiDurationMs = Date.now() - aiStart;
    console.log(`⏱️ prepare-visit: AI call took ${aiDurationMs}ms (model=${PREPARE_VISIT_MODEL})`);

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text().catch(() => "");
      console.error(`prepare-visit: Claude error model=${PREPARE_VISIT_MODEL} status=${status} body=${errText.slice(0, 300)}`);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please retry in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 400 && /context|token|too\s*long/i.test(errText)) {
        return new Response(
          JSON.stringify({ error: "Trop de données envoyées au modèle. Réduisez la sélection d'exposants." }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI Gateway error: ${status}`);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.content?.[0]?.text || "";

    // ── PARSE RESPONSE ───────────────────────────────────────────────────────
    let recommendations;
    try {
      recommendations = parseClaudeRecommendations(rawContent);
    } catch {
      console.error("prepare-visit: réponse Claude non parsable (traité comme vide):", rawContent.slice(0, 500));
      return new Response(JSON.stringify({
        prioritaires: [],
        optionnels: [],
        totalExhibitors: totalParticipations,
        analyzedExhibitors: totalAnalyzed,
        ai_duration_ms: aiDurationMs,
        mode,
        under_threshold,
        qualified_count,
        candidates_sent: candidates.length,
        ai_parse_failed: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ══════ STEP 3: ENRICH & SPLIT RESULTS ═══════════════════════════════════
    const exhibitorMap = new Map(candidatesPool.map((ex) => [String(ex.id), ex]));

    const enrichItem = (item: any) => {
      const ex = exhibitorMap.get(String(item.exhibitor_id));
      return {
        exhibitor_id: item.exhibitor_id,
        raison: item.raison,
        name: ex?.name || "Inconnu",
        logo_url: ex?.logo_url || null,
        website: ex?.website || null,
        stand: ex?.stand || null,
        secteur_principal: ex?.secteur_principal || null,
      };
    };

    const results = recommendations.results || [];

    const highIds = new Set(
      results.filter((r: any) => r.priority === "high").map((r: any) => String(r.exhibitor_id)),
    );

    const prioritaires = results
      .filter((r: any) => r.priority === "high" && exhibitorMap.has(String(r.exhibitor_id)))
      .map(enrichItem);
    const optionnels = results
      .filter((r: any) => r.priority === "medium" && exhibitorMap.has(String(r.exhibitor_id)) && !highIds.has(String(r.exhibitor_id)))
      .map(enrichItem);

    const result = {
      prioritaires,
      optionnels,
      totalExhibitors: totalParticipations,
      analyzedExhibitors: totalAnalyzed,
      ai_duration_ms: aiDurationMs,
      mode,
      under_threshold,
      qualified_count,
      candidates_sent: candidates.length,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("prepare-visit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
