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
    
    return new Response(
      JSON.stringify({ 
        ok: true,
        novelty_id,
        status: next_status
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
