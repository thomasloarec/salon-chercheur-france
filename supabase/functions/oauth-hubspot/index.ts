import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSignedState } from "../_shared/oauth-state.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const FUNCTION_VERSION = "2025-09-03-v1";

function log(req: Request, stage: string, data: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    stage, method: req.method, url: req.url,
    origin: req.headers.get("Origin") || "no-origin",
    ua: (req.headers.get("User-Agent") || "").slice(0, 120),
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
    return new Response(JSON.stringify({ error: "Method not allowed", stage: "method_validation" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) }
    });
  }

  try {
    // Vérification des variables d'environnement obligatoires
    const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
    const redirectUri = Deno.env.get("HUBSPOT_REDIRECT_URI");
    
    const missing = [];
    if (!clientId) missing.push("HUBSPOT_CLIENT_ID");
    if (!redirectUri) missing.push("HUBSPOT_REDIRECT_URI");
    
    if (missing.length > 0) {
      log(req, "config_missing", { missing });
      return new Response(JSON.stringify({ 
        code: "CONFIG_MISSING", 
        missing, 
        message: "Configuration OAuth incomplète" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Récupérer l'utilisateur si connecté (optionnel)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        if (supabaseUrl && anonKey) {
          const supabase = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } }
          });
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id || null;
        }
      } catch (e) {
        // Utilisateur non connecté ou token invalide - c'est OK
        log(req, "auth_optional_failed", { error: String(e) });
      }
    }

    // Générer state pour anti-CSRF
    const state = await createSignedState(userId || "anonymous");

    // Construire l'URL d'autorisation HubSpot
    const scopes = "oauth crm.objects.companies.read crm.objects.contacts.read";
    const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
    if (!clientId || !redirectUri) {
      return new Response(JSON.stringify({
        success: false,
        stage: "config_validation",
        message: "Missing required OAuth configuration"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }
    
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);

    log(req, "oauth_init_success", { 
      hasUserId: !!userId,
      redirectUri,
      scopes
    });

    return new Response(JSON.stringify({
      installUrl: authUrl.toString(),
      state,
      version: FUNCTION_VERSION
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) }
    });

  } catch (error) {
    log(req, "oauth_init_error", { error: String(error) });
    return new Response(JSON.stringify({ 
      code: "OAUTH_INIT_ERROR", 
      message: String(error) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) }
    });
  }
});