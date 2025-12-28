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
  // Nouveau champ: ID de l'exposant créé avec cette nouveauté (en attente d'approbation)
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
    // VÉRIFICATION QUOTA CÔTÉ SERVEUR (BLOQUANTE)
    // ==========================================
    
    // Vérifier entitlement premium
    const { data: entitlement } = await admin
      .from("premium_entitlements")
      .select("max_novelties")
      .eq("exhibitor_id", data.exhibitor_id)
      .eq("event_id", data.event_id)
      .is("revoked_at", null)
      .maybeSingle();

    const isPremium = !!entitlement;
    const maxNovelties = isPremium ? entitlement.max_novelties : 1;

    // Compter les nouveautés existantes (hors rejected)
    const { count: currentCount, error: countErr } = await admin
      .from("novelties")
      .select("id", { count: "exact", head: true })
      .eq("exhibitor_id", data.exhibitor_id)
      .eq("event_id", data.event_id)
      .in("status", ["draft", "pending", "under_review", "published"]);

    if (countErr) {
      console.error("[novelties-create] Error counting novelties:", countErr);
      return new Response(
        JSON.stringify({ error: "Failed to check quota" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    const noveltyCount = currentCount || 0;
    console.log(`[novelties-create] Quota check: ${noveltyCount}/${maxNovelties} (premium: ${isPremium})`);

    if (noveltyCount >= maxNovelties) {
      console.error("[novelties-create] Quota exceeded:", { noveltyCount, maxNovelties, isPremium });
      return new Response(
        JSON.stringify({ 
          error: "Quota exceeded",
          message: isPremium 
            ? `Limite atteinte: ${maxNovelties} nouveauté(s) maximum pour votre forfait Premium.`
            : "Plan gratuit: 1 nouveauté maximum par exposant et par événement. Passez au forfait Premium pour en publier davantage.",
          code: "QUOTA_EXCEEDED",
          current: noveltyCount,
          limit: maxNovelties
        }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // Map frontend values to database constraint values
    const typeMapping: Record<string, string> = {
      'Launch': 'Launch',
      'Update': 'MajorUpdate',
      'Prototype': 'Prototype',
      'Demo': 'LiveDemo',
      'Partnership': 'Partnership',
      'Offer': 'Offer',
      'Talk': 'Talk'
    };

    const mappedType = typeMapping[data.novelty_type.trim()] || 'Launch';

    // Mapping front → DB
    const insertPayload: Record<string, unknown> = {
      event_id: data.event_id,
      exhibitor_id: data.exhibitor_id,
      title: data.title.trim(),
      type: mappedType,
      reason_1: data.reason.trim(),
      media_urls: data.images,
      images_count: data.images.length,
      doc_url: data.brochure_pdf ?? null,
      stand_info: data.stand_info ?? null,
      created_by: data.created_by,
      status: "draft",
    };

    // Si un nouvel exposant a été créé avec cette nouveauté, le tracker
    if (data.pending_exhibitor_id) {
      insertPayload.pending_exhibitor_id = data.pending_exhibitor_id;
      console.log("[novelties-create] Tracking pending exhibitor:", data.pending_exhibitor_id);
    }

    console.log("[novelties-create] Insert payload:", JSON.stringify({
      ...insertPayload,
      media_urls: (insertPayload.media_urls as string[]).length,
    }));

    const { data: inserted, error: insErr } = await admin
      .from("novelties")
      .insert([insertPayload])
      .select("id, title")
      .single();

    if (insErr) {
      console.error("[novelties-create] Insert error raw:", JSON.stringify(insErr, null, 2));
      return new Response(
        JSON.stringify({ 
          error: insErr.message, 
          details: insErr.details,
          hint: insErr.hint,
          code: insErr.code,
          table: "novelties",
          step: "insert"
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    console.log("[novelties-create] Success:", inserted.id);
    return new Response(
      JSON.stringify({ 
        id: inserted.id, 
        title: inserted.title,
        pending_exhibitor_id: data.pending_exhibitor_id || null
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
