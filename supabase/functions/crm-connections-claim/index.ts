import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const FUNCTION_VERSION = "2025-09-03-v2";

function log(req: Request, stage: string, data: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    stage, method: req.method, url: req.url,
    origin: req.headers.get("Origin") || "no-origin",
    ...data
  };
  console.log(JSON.stringify(entry));
}

serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) }
    });
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      log(req, "auth_missing");
      return new Response(JSON.stringify({ 
        code: "USER_SESSION_MISSING", 
        message: "Authentification requise pour réclamer une connexion" 
      }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Initialiser Supabase avec le token utilisateur
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ 
        code: "CONFIG_MISSING", 
        message: "Configuration Supabase manquante" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      log(req, "auth_invalid", { error: authError?.message });
      return new Response(JSON.stringify({ 
        code: "USER_SESSION_INVALID", 
        message: "Session utilisateur invalide" 
      }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Parser le body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ 
        code: "INVALID_JSON", 
        message: "Corps de requête JSON invalide" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    const { claim_token } = body;
    if (!claim_token || typeof claim_token !== 'string') {
      return new Response(JSON.stringify({ 
        code: "CLAIM_TOKEN_MISSING", 
        message: "Token de réclamation manquant" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Utiliser le service role pour accéder à la connexion unclaimed
    const supabaseService = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    // Vérifier et récupérer la connexion unclaimed
    const { data: connection, error: fetchError } = await supabaseService
      .from('crm_connections')
      .select('*')
      .eq('claim_token', claim_token)
      .eq('status', 'unclaimed')
      .single();

    if (fetchError || !connection) {
      log(req, "claim_token_not_found", { 
        claim_token: claim_token.slice(0, 8) + "...",
        error: fetchError?.message 
      });
      return new Response(JSON.stringify({ 
        code: "CLAIM_TOKEN_INVALID", 
        message: "Token de réclamation invalide ou déjà utilisé" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Vérifier l'expiration
    if (connection.claim_token_expires_at && new Date(connection.claim_token_expires_at) < new Date()) {
      log(req, "claim_token_expired", { 
        claim_token: claim_token.slice(0, 8) + "...",
        expired_at: connection.claim_token_expires_at 
      });
      return new Response(JSON.stringify({ 
        code: "CLAIM_TOKEN_EXPIRED", 
        message: "Token de réclamation expiré" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Attacher la connexion à l'utilisateur
    const { error: updateError } = await supabaseService
      .from('crm_connections')
      .update({
        user_id: user.id,
        status: 'active',
        claim_token: null,
        claim_token_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);

    if (updateError) {
      log(req, "claim_update_failed", { 
        connectionId: connection.id,
        error: updateError.message 
      });
      return new Response(JSON.stringify({ 
        code: "CLAIM_UPDATE_FAILED", 
        message: "Échec de la réclamation de la connexion" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    log(req, "claim_success", { 
      connectionId: connection.id,
      userId: user.id.slice(0, 8) + "...",
      provider: connection.provider 
    });

    return new Response(JSON.stringify({
      ok: true,
      status: "active",
      provider: connection.provider,
      version: FUNCTION_VERSION
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) }
    });

  } catch (error) {
    log(req, "general_error", { error: String(error) });
    return new Response(JSON.stringify({ 
      code: "INTERNAL_ERROR", 
      message: String(error) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) }
    });
  }
});