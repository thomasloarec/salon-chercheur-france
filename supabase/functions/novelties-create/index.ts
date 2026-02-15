import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const uuid = z.string().uuid();
const url = z.string().url();

const schema = z.object({
  event_id: uuid,
  exhibitor_id: uuid,
  created_by: uuid,
  title: z.string().min(3).max(200),
  novelty_type: z.string().min(1),
  reason: z.string().min(10).max(1000),
  images: z.array(z.string().url()).min(1).max(3),
  brochure_pdf: url.optional().nullable(),
  stand_info: z.string().max(200).optional().nullable(),
  pending_exhibitor_id: uuid.optional().nullable(),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

const validTypes = ['Launch', 'Update', 'Demo', 'Special_Offer', 'Partnership', 'Innovation'];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("[novelties-create] Missing env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    const body = await req.json();
    console.log("[novelties-create] Received payload:", JSON.stringify({
      ...body,
      images: body.images?.length,
      brochure_pdf: body.brochure_pdf ? "present" : "absent",
      pending_exhibitor_id: body.pending_exhibitor_id || "none"
    }));

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      console.error("[novelties-create] Validation error:", flat);
      return new Response(
        JSON.stringify({ 
          error: "Validation error", 
          details: flat.fieldErrors,
          code: "ZOD_VALIDATION"
        }),
        { status: 400, headers: corsHeaders() }
      );
    }
    const data = parsed.data;

    // Validate novelty type
    const noveltyType = data.novelty_type.trim();
    if (!validTypes.includes(noveltyType)) {
      console.error("[novelties-create] Invalid novelty type:", noveltyType);
      return new Response(
        JSON.stringify({ error: "Invalid novelty type", received: noveltyType }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Vérifier l'événement
    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("id")
      .eq("id", data.event_id)
      .single();

    if (evErr || !ev) {
      console.error("[novelties-create] Invalid event_id:", data.event_id, evErr);
      return new Response(
        JSON.stringify({ error: "Invalid event_id" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // Vérifier l'exposant
    const { data: exhib, error: exhibErr } = await admin
      .from("exhibitors")
      .select("id, plan")
      .eq("id", data.exhibitor_id)
      .single();

    if (exhibErr || !exhib) {
      console.error("[novelties-create] Invalid exhibitor_id:", data.exhibitor_id, exhibErr);
      return new Response(
        JSON.stringify({ error: "Invalid exhibitor_id" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // ==========================================
    // CRÉATION ATOMIQUE AVEC VÉRIFICATION QUOTA
    // Utilise pg_advisory_xact_lock pour empêcher les race conditions
    // ==========================================
    const { data: result, error: rpcErr } = await admin.rpc("create_novelty_atomic", {
      p_event_id: data.event_id,
      p_exhibitor_id: data.exhibitor_id,
      p_created_by: data.created_by,
      p_title: data.title,
      p_type: noveltyType,
      p_reason: data.reason,
      p_images: data.images,
      p_brochure_pdf: data.brochure_pdf ?? null,
      p_stand_info: data.stand_info ?? null,
      p_pending_exhibitor_id: data.pending_exhibitor_id ?? null,
    });

    if (rpcErr) {
      console.error("[novelties-create] RPC error:", JSON.stringify(rpcErr, null, 2));
      return new Response(
        JSON.stringify({ error: rpcErr.message, code: "RPC_ERROR" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    // La fonction retourne { error: true/false, ... }
    if (result.error) {
      console.error("[novelties-create] Quota exceeded:", result);
      return new Response(
        JSON.stringify({
          error: "Quota exceeded",
          message: result.message,
          code: result.code,
          current: result.current,
          limit: result.limit,
        }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // ==========================================
    // ENVOI VERS AIRTABLE "Publication Nouveauté"
    // ==========================================
    try {
      const airtableBaseId = Deno.env.get("AIRTABLE_PUBLICATION_BASE_ID");
      const airtablePat = Deno.env.get("AIRTABLE_PUBLICATION_PAT");
      
      if (airtableBaseId && airtablePat) {
        const { data: eventData } = await admin
          .from("events")
          .select("nom_event")
          .eq("id", data.event_id)
          .single();

        const { data: exhibitorData } = await admin
          .from("exhibitors")
          .select("name")
          .eq("id", data.exhibitor_id)
          .single();

        const tableName = encodeURIComponent("Table 1");
        const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/${tableName}`;

        const airtablePayload = {
          records: [{
            fields: {
              "Name": data.title.trim(),
              "Événement": eventData?.nom_event || "Événement inconnu",
              "Entreprise": exhibitorData?.name || "Entreprise inconnue",
              "Date": new Date().toISOString().split('T')[0],
            }
          }]
        };

        console.log("[novelties-create] Sending to Airtable:", JSON.stringify(airtablePayload));

        const airtableResponse = await fetch(airtableUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${airtablePat}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(airtablePayload),
        });

        if (airtableResponse.ok) {
          console.log("[novelties-create] Airtable sync successful");
        } else {
          const errorText = await airtableResponse.text();
          console.error("[novelties-create] Airtable sync failed:", errorText);
        }
      } else {
        console.log("[novelties-create] Airtable publication secrets not configured, skipping sync");
      }
    } catch (airtableError) {
      console.error("[novelties-create] Airtable sync error (non-blocking):", airtableError);
    }

    console.log("[novelties-create] Success:", result.id);
    return new Response(
      JSON.stringify({ 
        id: result.id, 
        title: result.title,
        pending_exhibitor_id: result.pending_exhibitor_id || null
      }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (e) {
    console.error("[novelties-create] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: corsHeaders() }
    );
  }
});
