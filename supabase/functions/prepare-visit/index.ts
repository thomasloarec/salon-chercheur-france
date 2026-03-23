import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Objective → keyword mapping for type_interet scoring
const OBJECTIVE_KEYWORDS: Record<string, string> = {
  "Trouver de nouveaux fournisseurs": "fournisseur",
  "Identifier des partenaires": "partenaire",
  "Faire de la veille concurrentielle": "concurrent",
  "Découvrir les innovations du marché": "veille_techno",
};

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
      try {
        return JSON.parse(repairedJson);
      } catch {
        // Continue with object-level salvage below.
      }
    }
  }

  const objectMatches = jsonStr.match(/\{\s*"exhibitor_id"\s*:\s*"(?:\\.|[^"\\])+"\s*,\s*"raison"\s*:\s*"(?:\\.|[^"\\])*"\s*,\s*"priority"\s*:\s*"(?:high|medium)"\s*\}/g) || [];
  const recoveredResults = objectMatches.flatMap((match) => {
    try {
      return [JSON.parse(match)];
    } catch {
      return [];
    }
  });

  return recoveredResults.length > 0 ? { results: recoveredResults } : null;
}

function parseClaudeRecommendations(rawContent: string): { results: any[] } {
  const jsonStr = stripCodeFences(rawContent);

  try {
    return JSON.parse(jsonStr);
  } catch {
    const salvaged = salvageClaudeResults(rawContent);
    if (salvaged) {
      console.warn(`prepare-visit: Claude JSON repaired with ${salvaged.results.length} result(s)`);
      return salvaged;
    }

    throw new Error("Failed to parse AI response");
  }
}

async function fetchAiRowsInBatches(
  supabase: ReturnType<typeof createClient>,
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
        .select("exhibitor_id, secteur_principal, produits_services, mots_cles_metier, profils_visiteurs, type_interet, resume_court")
        .in("exhibitor_id", batch)
        .range(0, 4999),
    ),
  );

  batchResults.forEach(({ data: aiRows }) => {
    aiRows?.forEach((row) => {
      aiData[row.exhibitor_id] = row;
    });
  });

  return aiData;
}

function scoreExhibitor(
  ex: any,
  userRole: string,
  userKeywords: string[],
  objectiveKeyword: string | undefined
): number {
  let score = 0;

  // +3 if profils_visiteurs matches role
  const profils = (ex.profils_visiteurs || []).map((p: string) => p.toLowerCase());
  if (profils.some((p: string) => p.includes(userRole) || userRole.includes(p))) {
    score += 3;
  }

  // +2 per keyword match, cap at +4
  const motsCles = (ex.mots_cles_metier || []).map((m: string) => m.toLowerCase());
  let kwScore = 0;
  for (const kw of userKeywords) {
    if (motsCles.some((m: string) => m.includes(kw) || kw.includes(m))) {
      kwScore += 2;
      if (kwScore >= 4) break;
    }
  }
  score += kwScore;

  // +1 if type_interet matches objective
  if (objectiveKeyword) {
    const types = (ex.type_interet || []).map((t: string) => t.toLowerCase());
    if (types.some((t: string) => t.includes(objectiveKeyword))) {
      score += 1;
    }
  }

  // +1 if resume_court is not empty
  if (ex.resume_court && ex.resume_court.trim()) score += 1;

  // +1 if secteur_principal is meaningful
  if (ex.secteur_principal && ex.secteur_principal !== "Non déterminé") score += 1;

  return score;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { eventId, role, objective, keywords, duration } = await req.json();

    if (!eventId || !role || !objective) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- GET EVENT ---
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("id, id_event, nom_event")
      .eq("id", eventId)
      .single();

    if (eventError || !eventData) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- GET ALL PARTICIPATIONS ---
    const { data: participations } = await supabase
      .from("participation")
      .select("exhibitor_id, id_exposant")
      .eq("id_event_text", eventData.id_event)
      .range(0, 1999);

    if (!participations || participations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No exhibitors found", exhibitorCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Split modern vs legacy
    const modernIds = participations
      .map((p) => p.exhibitor_id)
      .filter(Boolean) as string[];
    const legacyIds = participations
      .filter((p) => !p.exhibitor_id && p.id_exposant)
      .map((p) => p.id_exposant) as string[];

    // --- FETCH EXHIBITORS (parallel) ---
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

    // --- MERGE INTO UNIFIED LIST ---
    const seenIds = new Set<string>();
    const allExhibitors: any[] = [];

    for (const ex of modernExhibitors) {
      if (seenIds.has(ex.id)) continue;
      seenIds.add(ex.id);
      const ai = aiData[ex.id] || {};
      allExhibitors.push({
        id: ex.id, name: ex.name, description: ex.description || "",
        website: ex.website, logo_url: ex.logo_url,
        secteur_principal: ai.secteur_principal || null,
        produits_services: ai.produits_services || [],
        mots_cles_metier: ai.mots_cles_metier || [],
        profils_visiteurs: ai.profils_visiteurs || [],
        type_interet: ai.type_interet || [],
        resume_court: ai.resume_court || null,
      });
    }

    const modernNames = new Set(modernExhibitors.map((e) => (e.name || "").toLowerCase().trim()));
    for (const ex of legacyExhibitors) {
      const name = (ex.nom_exposant || "").trim();
      if (!name || modernNames.has(name.toLowerCase())) continue;
      const key = `legacy_${ex.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      const ai = aiData[String(ex.id)] || {};
      allExhibitors.push({
        id: ex.id_exposant || String(ex.id), name,
        description: ex.exposant_description || "",
        website: ex.website_exposant, logo_url: null,
        secteur_principal: ai.secteur_principal || null,
        produits_services: ai.produits_services || [],
        mots_cles_metier: ai.mots_cles_metier || [],
        profils_visiteurs: ai.profils_visiteurs || [],
        type_interet: ai.type_interet || [],
        resume_court: ai.resume_court || null,
      });
    }

    const totalExhibitors = allExhibitors.length;
    console.log(`📊 prepare-visit: ${totalExhibitors} exhibitors total (${modernExhibitors.length} modern, ${legacyExhibitors.length} legacy)`);

    // ===== STEP 1: ALGORITHMIC PRE-SCORING =====
    const userRole = role.toLowerCase();
    const userKeywords = (keywords || []).map((k: string) => k.toLowerCase());
    const objectiveKeyword = OBJECTIVE_KEYWORDS[objective]?.toLowerCase();

    const scored = allExhibitors.map((ex) => ({
      ...ex,
      _score: scoreExhibitor(ex, userRole, userKeywords, objectiveKeyword),
    }));

    scored.sort((a, b) => b._score - a._score);
    const top30 = scored.slice(0, 30).map(({ _score, ...rest }) => rest);

    console.log(`🎯 prepare-visit: top 30 scores — highest=${scored[0]?._score ?? 0}, lowest of top30=${scored[Math.min(29, scored.length - 1)]?._score ?? 0}`);

    // ===== STEP 2: CLAUDE WRITES REASONS ONLY =====
    const exhibitorsForPrompt = top30.map((ex) => ({
      id: ex.id, name: ex.name,
      secteur_principal: ex.secteur_principal,
      resume_court: ex.resume_court || ex.description || null,
    }));

    const prompt = `Tu es un assistant expert en salons professionnels B2B.

Profil visiteur :
- Rôle : ${role}
- Objectif : ${objective}
- Centres d'intérêt : ${(keywords || []).join(", ") || "Non précisé"}
- Temps disponible : ${duration || "Non précisé"}

Voici les 30 exposants présélectionnés pour ce visiteur :
${JSON.stringify(exhibitorsForPrompt)}

Pour chacun, rédige une raison personnalisée en 1 phrase qui commence par "Pour un profil ${role}..." et mentionne un bénéfice concret lié à l'objectif du visiteur.

Retourne UNIQUEMENT un JSON valide sans markdown, sans backtick, sans texte avant ou après :
{
  "results": [
    {"exhibitor_id": "...", "raison": "...", "priority": "high" ou "medium"}
  ]
}

Marque "high" les 12 meilleurs, "medium" les autres.
Ne jamais inventer d'informations absentes des données fournies.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const aiResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please retry in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", status, errText);
      throw new Error(`AI Gateway error: ${status}`);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.content?.[0]?.text || "";

    // --- PARSE RESPONSE ---
    let recommendations;
    try {
      recommendations = parseClaudeRecommendations(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: rawContent.slice(0, 200) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== STEP 3: ENRICH & SPLIT RESULTS =====
    const exhibitorMap = new Map(top30.map((ex) => [String(ex.id), ex]));

    const enrichItem = (item: any) => {
      const ex = exhibitorMap.get(String(item.exhibitor_id));
      return {
        exhibitor_id: item.exhibitor_id,
        raison: item.raison,
        name: ex?.name || "Inconnu",
        logo_url: ex?.logo_url || null,
        website: ex?.website || null,
        secteur_principal: ex?.secteur_principal || null,
      };
    };

    const results = recommendations.results || [];
    const prioritaires = results
      .filter((r: any) => r.priority === "high")
      .map(enrichItem);
    const optionnels = results
      .filter((r: any) => r.priority === "medium")
      .map(enrichItem);

    const result = {
      prioritaires,
      optionnels,
      totalExhibitors,
      analyzedExhibitors: top30.length,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("prepare-visit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
