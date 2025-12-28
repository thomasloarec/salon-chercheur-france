import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const schema = z.object({
  novelty_id: z.string().uuid(),
  next_status: z.enum(['under_review', 'published', 'rejected']),
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("[novelties-moderate] Missing env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    // Admin client with service role (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Auth client to validate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error("[novelties-moderate] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders() }
      );
    }

    // Check if user is admin
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !userRoles) {
      console.error("[novelties-moderate] Not admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin role required" }),
        { status: 403, headers: corsHeaders() }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const parsed = schema.safeParse(body);
    
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      console.error("[novelties-moderate] Validation error:", flat);
      return new Response(
        JSON.stringify({ 
          error: "Validation error", 
          details: flat.fieldErrors 
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const { novelty_id, next_status } = parsed.data;

    console.log(`[novelties-moderate] Admin ${user.id} updating novelty ${novelty_id} to ${next_status}`);

    // Récupérer la nouveauté actuelle pour vérifier s'il y a un exposant en attente
    const { data: novelty, error: fetchError } = await supabaseAdmin
      .from('novelties')
      .select('id, pending_exhibitor_id, exhibitor_id')
      .eq('id', novelty_id)
      .single();

    if (fetchError || !novelty) {
      console.error("[novelties-moderate] Novelty not found:", novelty_id, fetchError);
      return new Response(
        JSON.stringify({ error: "Novelty not found" }),
        { status: 404, headers: corsHeaders() }
      );
    }

    // Update novelty status using service role (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from('novelties')
      .update({
        status: next_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', novelty_id);

    if (updateError) {
      console.error("[novelties-moderate] Update error:", updateError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to update novelty status",
          details: updateError.message 
        }),
        { status: 500, headers: corsHeaders() }
      );
    }

    console.log(`[novelties-moderate] Success: novelty ${novelty_id} → ${next_status}`);

    // ============================================
    // SI PUBLICATION: Approuver l'exposant en attente ET créer la participation
    // ============================================
    let exhibitorApproved = false;
    let participationCreated = false;
    
    if (next_status === 'published' && novelty.pending_exhibitor_id) {
      console.log(`[novelties-moderate] Approving pending exhibitor: ${novelty.pending_exhibitor_id}`);
      
      const { error: approveError } = await supabaseAdmin
        .from('exhibitors')
        .update({ 
          approved: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', novelty.pending_exhibitor_id);

      if (approveError) {
        console.error("[novelties-moderate] Failed to approve exhibitor:", approveError);
        // On ne fait pas échouer la modération pour ça, mais on log l'erreur
      } else {
        exhibitorApproved = true;
        console.log(`[novelties-moderate] Exhibitor ${novelty.pending_exhibitor_id} approved`);
        
        // ✅ CRÉER LA PARTICIPATION maintenant que la nouveauté est publiée
        // Récupérer les infos de l'exposant et de l'événement
        const { data: exhibitorData } = await supabaseAdmin
          .from('exhibitors')
          .select('website, stand_info')
          .eq('id', novelty.pending_exhibitor_id)
          .single();
        
        const { data: noveltyData } = await supabaseAdmin
          .from('novelties')
          .select('event_id')
          .eq('id', novelty_id)
          .single();

        if (noveltyData?.event_id) {
          // Récupérer l'id_event_text depuis events
          const { data: eventData } = await supabaseAdmin
            .from('events')
            .select('id_event')
            .eq('id', noveltyData.event_id)
            .single();

          // Vérifier si une participation existe déjà
          const { data: existingParticipation } = await supabaseAdmin
            .from('participation')
            .select('id_participation')
            .eq('exhibitor_id', novelty.pending_exhibitor_id)
            .eq('id_event', noveltyData.event_id)
            .maybeSingle();

          if (!existingParticipation) {
            const { error: participationError } = await supabaseAdmin
              .from('participation')
              .insert({
                id_exposant: novelty.pending_exhibitor_id,
                exhibitor_id: novelty.pending_exhibitor_id,
                id_event: noveltyData.event_id,
                id_event_text: eventData?.id_event || null,
                website_exposant: exhibitorData?.website || null,
                stand_exposant: exhibitorData?.stand_info || null,
                urlexpo_event: null
              });

            if (participationError) {
              console.error("[novelties-moderate] Failed to create participation:", participationError);
            } else {
              participationCreated = true;
              console.log(`[novelties-moderate] Participation created for exhibitor ${novelty.pending_exhibitor_id} on event ${noveltyData.event_id}`);
            }
          } else {
            console.log(`[novelties-moderate] Participation already exists for exhibitor ${novelty.pending_exhibitor_id}`);
            participationCreated = true;
          }
        }
        
        // Nettoyer le champ pending_exhibitor_id
        await supabaseAdmin
          .from('novelties')
          .update({ pending_exhibitor_id: null })
          .eq('id', novelty_id);
      }
    }

    // Si rejet et qu'il y avait un exposant en attente, on pourrait le supprimer
    // Mais pour l'instant on le laisse (l'admin peut le supprimer manuellement)
    if (next_status === 'rejected' && novelty.pending_exhibitor_id) {
      console.log(`[novelties-moderate] Note: Novelty rejected but pending exhibitor ${novelty.pending_exhibitor_id} kept for review`);
    }
    
    return new Response(
      JSON.stringify({ 
        ok: true,
        novelty_id,
        status: next_status,
        exhibitor_approved: exhibitorApproved,
        participation_created: participationCreated,
        pending_exhibitor_id: novelty.pending_exhibitor_id
      }),
      { status: 200, headers: corsHeaders() }
    );

  } catch (e) {
    console.error("[novelties-moderate] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: corsHeaders() }
    );
  }
});
