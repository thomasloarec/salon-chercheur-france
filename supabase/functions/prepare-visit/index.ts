import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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

    // 1. Get event's id_event
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

    // 2. Get ALL participations for this event
    const { data: participations } = await supabase
      .from("participation")
      .select("exhibitor_id, id_exposant")
      .eq("id_event_text", eventData.id_event);

    if (!participations || participations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No exhibitors found", exhibitorCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Split into modern (exhibitor_id) and legacy (id_exposant only)
    const modernIds = participations
      .map((p) => p.exhibitor_id)
      .filter(Boolean) as string[];

    const legacyIds = participations
      .filter((p) => !p.exhibitor_id && p.id_exposant)
      .map((p) => p.id_exposant) as string[];

    // --- GROUP A: Modern exhibitors ---
    let modernExhibitors: any[] = [];
    if (modernIds.length > 0) {
      const { data } = await supabase
        .from("exhibitors")
        .select("id, name, description, website, logo_url")
        .in("id", modernIds);
      modernExhibitors = data || [];
    }

    // --- GROUP B: Legacy exhibitors ---
    let legacyExhibitors: any[] = [];
    if (legacyIds.length > 0) {
      // Fetch in batches if needed (Supabase limit)
      const batchSize = 500;
      for (let i = 0; i < legacyIds.length; i += batchSize) {
        const batch = legacyIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from("exposants")
          .select("id, id_exposant, nom_exposant, exposant_description, website_exposant")
          .in("id_exposant", batch);
        if (data) legacyExhibitors.push(...data);
      }
    }

    // --- AI ENRICHMENT ---
    // Collect all IDs to query exhibitor_ai
    // Modern: exhibitor_id (uuid as text), Legacy: exposants.id (integer as text)
    const aiLookupIds: string[] = [
      ...modernExhibitors.map((e) => e.id),
      ...legacyExhibitors.map((e) => String(e.id)),
    ];

    let aiData: Record<string, any> = {};
    if (aiLookupIds.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < aiLookupIds.length; i += batchSize) {
        const batch = aiLookupIds.slice(i, i + batchSize);
        const { data: aiRows } = await supabase
          .from("exhibitor_ai")
          .select("exhibitor_id, secteur_principal, produits_services, mots_cles_metier, profils_visiteurs, type_interet, resume_court")
          .in("exhibitor_id", batch);
        if (aiRows) {
          aiRows.forEach((row) => {
            aiData[row.exhibitor_id] = row;
          });
        }
      }
    }

    // --- MERGE into unified list ---
    const seenIds = new Set<string>();
    let enrichedExhibitors: any[] = [];

    // Add modern exhibitors
    for (const ex of modernExhibitors) {
      const key = ex.id;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      const ai = aiData[key] || {};
      enrichedExhibitors.push({
        id: key,
        name: ex.name,
        description: ex.description || "",
        website: ex.website,
        logo_url: ex.logo_url,
        secteur_principal: ai.secteur_principal || null,
        produits_services: ai.produits_services || [],
        mots_cles_metier: ai.mots_cles_metier || [],
        profils_visiteurs: ai.profils_visiteurs || [],
        type_interet: ai.type_interet || [],
        resume_court: ai.resume_court || null,
      });
    }

    // Add legacy exhibitors (deduplicate by name against modern ones)
    const modernNames = new Set(modernExhibitors.map((e) => (e.name || "").toLowerCase().trim()));
    for (const ex of legacyExhibitors) {
      const name = (ex.nom_exposant || "").trim();
      if (!name) continue;
      if (modernNames.has(name.toLowerCase())) continue;
      const key = `legacy_${ex.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      const ai = aiData[String(ex.id)] || {};
      enrichedExhibitors.push({
        id: ex.id_exposant || String(ex.id),
        name,
        description: ex.exposant_description || "",
        website: ex.website_exposant,
        logo_url: null,
        secteur_principal: ai.secteur_principal || null,
        produits_services: ai.produits_services || [],
        mots_cles_metier: ai.mots_cles_metier || [],
        profils_visiteurs: ai.profils_visiteurs || [],
        type_interet: ai.type_interet || [],
        resume_court: ai.resume_court || null,
      });
    }

    const totalExhibitors = enrichedExhibitors.length;

    console.log(`📊 prepare-visit: ${totalExhibitors} exhibitors total (${modernExhibitors.length} modern, ${legacyExhibitors.length} legacy)`);

    // --- PRE-FILTER if > 150 exhibitors ---
    if (enrichedExhibitors.length > 150) {
      const userKeywords = (keywords || []).map((k: string) => k.toLowerCase());
      const userRole = role.toLowerCase();

      const scored = enrichedExhibitors.map((ex) => {
        let score = 0;
        const profils = (ex.profils_visiteurs || []).map((p: string) => p.toLowerCase());
        if (profils.some((p: string) => p.includes(userRole) || userRole.includes(p))) {
          score += 3;
        }
        const motsCles = (ex.mots_cles_metier || []).map((m: string) => m.toLowerCase());
        const produits = (ex.produits_services || []).map((p: string) => p.toLowerCase());
        const allTerms = [...motsCles, ...produits];
        for (const kw of userKeywords) {
          if (allTerms.some((t: string) => t.includes(kw) || kw.includes(t))) {
            score += 2;
          }
        }
        if (ex.resume_court || ex.secteur_principal) score += 1;
        return { ...ex, _score: score };
      });

      scored.sort((a, b) => b._score - a._score);
      enrichedExhibitors = scored.slice(0, 100).map(({ _score, ...rest }) => rest);
    }

    // --- BUILD PROMPT ---
    const exhibitorsForPrompt = enrichedExhibitors.map((ex) => ({
      id: ex.id,
      name: ex.name,
      secteur_principal: ex.secteur_principal,
      produits_services: ex.produits_services,
      mots_cles_metier: ex.mots_cles_metier,
      profils_visiteurs: ex.profils_visiteurs,
      type_interet: ex.type_interet,
      resume_court: ex.resume_court || ex.description || null,
    }));

    const prompt = `Tu es un assistant expert en préparation de visites de salons professionnels B2B.

Profil du visiteur :
- Rôle : ${role}
- Objectif : ${objective}
- Centres d'intérêt : ${(keywords || []).join(", ") || "Non précisé"}
- Temps disponible : ${duration || "Non précisé"}

Voici la liste des exposants présents sur ce salon, avec leurs données :
${JSON.stringify(exhibitorsForPrompt)}

Retourne UNIQUEMENT un JSON valide, sans markdown, sans backtick, sans texte avant ou après.
Format exact :
{
  "prioritaires": [
    {
      "exhibitor_id": "uuid...",
      "raison": "Pour un profil ${role}, [entreprise] est incontournable car [bénéfice concret en 1 phrase]."
    }
  ],
  "optionnels": [
    {
      "exhibitor_id": "uuid...",
      "raison": "Peut être intéressant si [condition courte]."
    }
  ]
}

Règles strictes :
- prioritaires : entre 8 et 15 exposants maximum
- optionnels : entre 3 et 6 exposants maximum
- Chaque raison commence obligatoirement par "Pour un profil ${role}..." pour les prioritaires
- Ne jamais inventer d'informations absentes des données fournies
- Si un exposant n'a pas de resume_court, base-toi sur secteur_principal et produits_services uniquement`;

    // --- CALL ANTHROPIC ---
    const aiResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

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
      let jsonStr = rawContent.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      recommendations = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: rawContent }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- ENRICH RESULTS ---
    const exhibitorMap = new Map(
      enrichedExhibitors.map((ex) => [String(ex.id), ex])
    );

    const enrichRecommendation = (rec: any) => {
      const ex = exhibitorMap.get(String(rec.exhibitor_id));
      return {
        ...rec,
        name: ex?.name || "Inconnu",
        logo_url: ex?.logo_url || null,
        website: ex?.website || null,
        secteur_principal: ex?.secteur_principal || null,
      };
    };

    const result = {
      prioritaires: (recommendations.prioritaires || []).map(enrichRecommendation),
      optionnels: (recommendations.optionnels || []).map(enrichRecommendation),
      totalExhibitors,
      analyzedExhibitors: enrichedExhibitors.length,
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
