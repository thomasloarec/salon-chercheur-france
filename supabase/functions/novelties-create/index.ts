import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const uuid = z.string().uuid();
const url = z.string().url();

const schema = z.object({
  event_id: uuid,                // UUID de events.id
  exhibitor_id: uuid,            // UUID de exhibitors.id
  created_by: uuid,              // UUID user
  title: z.string().min(3),
  novelty_type: z.string().min(1),
  reason: z.string().min(10),
  images: z.array(z.string().url()).min(1).max(3),
  brochure_pdf: url.optional().nullable(),
  stand_info: z.string().max(200).optional().nullable(),
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
      return new Response(
        JSON.stringify({ message: "Edge env missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ message: "Validation error", errors: parsed.error.flatten() }),
        { status: 422, headers: corsHeaders() }
      );
    }
    const data = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // Vérifier l'événement par UUID (events.id)
    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("id, id_event, nom_event, visible")
      .eq("id", data.event_id)
      .single();

    if (evErr) {
      return new Response(
        JSON.stringify({ message: "Event lookup failed", details: evErr.message }),
        { status: 500, headers: corsHeaders() }
      );
    }
    if (!ev) {
      return new Response(JSON.stringify({ message: "Event not found" }), {
        status: 404,
        headers: corsHeaders(),
      });
    }

    // Vérifier l'exposant par UUID (exhibitors.id)
    const { data: exhib, error: exhibErr } = await admin
      .from("exhibitors")
      .select("id, name")
      .eq("id", data.exhibitor_id)
      .single();

    if (exhibErr) {
      return new Response(
        JSON.stringify({ message: "Exhibitor lookup failed", details: exhibErr.message }),
        { status: 500, headers: corsHeaders() }
      );
    }
    if (!exhib) {
      return new Response(JSON.stringify({ message: "Exhibitor not found" }), {
        status: 404,
        headers: corsHeaders(),
      });
    }

    // Insertion dans novelties
    const insertPayload = {
      event_id: data.event_id,              // UUID
      exhibitor_id: data.exhibitor_id,      // UUID
      title: data.title,
      type: data.novelty_type,
      reason_1: data.reason,
      media_urls: data.images,              // jsonb (array<string>)
      doc_url: data.brochure_pdf ?? null,
      stand_info: data.stand_info ?? null,
      created_at: new Date().toISOString(),
      created_by: data.created_by,          // si colonne existante
      status: "Published",
    };

    const { data: inserted, error: insErr } = await admin
      .from("novelties")
      .insert([insertPayload])
      .select()
      .single();

    if (insErr) {
      return new Response(
        JSON.stringify({ message: "Insert failed", details: insErr.message }),
        { status: 500, headers: corsHeaders() }
      );
    }

    return new Response(
      JSON.stringify({ message: "Created", novelty: { id: inserted.id, title: inserted.title } }),
      { status: 201, headers: corsHeaders() }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ message: "Unhandled error", error: String(e) }),
      { status: 500, headers: corsHeaders() }
    );
  }
});