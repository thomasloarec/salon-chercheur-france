import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_VERSION = "2025-09-03-v1";
const ALLOWED_ORIGINS = ["https://lotexpo.com", "https://www.lotexpo.com"];

const json = (req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...createCorsHeaders(req, extra) }
  });

function createCorsHeaders(req: Request, additional: Record<string, string> = {}) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    ...additional
  };
}

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
    log(req, "preflight");
    return new Response(null, { status: 204, headers: createCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      log(req, "auth_missing");
      return json(req, { 
        code: "USER_SESSION_MISSING", 
        message: "Authentification requise pour réclamer une connexion" 
      }, 401);
    }

    // Initialiser Supabase avec le token utilisateur
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(req, { 
        code: "CONFIG_MISSING", 
        message: "Configuration Supabase manquante" 
      }, 500);
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      log(req, "auth_invalid", { error: authError?.message });
      return json(req, { 
        code: "USER_SESSION_INVALID", 
        message: "Session utilisateur invalide" 
      }, 401);
    }

    // Parser le body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(req, { 
        code: "INVALID_JSON", 
        message: "Corps de requête JSON invalide" 
      }, 400);
    }

    const { claim_token } = body;
    if (!claim_token || typeof claim_token !== 'string') {
      return json(req, { 
        code: "CLAIM_TOKEN_MISSING", 
        message: "Token de réclamation manquant" 
      }, 400);
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
      return json(req, { 
        code: "CLAIM_TOKEN_INVALID", 
        message: "Token de réclamation invalide ou déjà utilisé" 
      }, 400);
    }

    // Vérifier l'expiration
    if (connection.claim_token_expires_at && new Date(connection.claim_token_expires_at) < new Date()) {
      log(req, "claim_token_expired", { 
        claim_token: claim_token.slice(0, 8) + "...",
        expired_at: connection.claim_token_expires_at 
      });
      return json(req, { 
        code: "CLAIM_TOKEN_EXPIRED", 
        message: "Token de réclamation expiré" 
      }, 400);
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
      return json(req, { 
        code: "CLAIM_UPDATE_FAILED", 
        message: "Échec de la réclamation de la connexion" 
      }, 500);
    }

    log(req, "claim_success", { 
      connectionId: connection.id,
      userId: user.id.slice(0, 8) + "...",
      provider: connection.provider 
    });

    return json(req, {
      ok: true,
      status: "active",
      provider: connection.provider,
      version: FUNCTION_VERSION
    });

  } catch (error) {
    log(req, "general_error", { error: String(error) });
    return json(req, { 
      code: "INTERNAL_ERROR", 
      message: String(error) 
    }, 500);
  }
});