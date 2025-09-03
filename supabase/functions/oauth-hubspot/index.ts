import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateSignedState } from "../_shared/oauth-state.ts";

const FUNCTION_VERSION = "2025-09-03-v1";
const ALLOWED_ORIGINS = ["https://lotexpo.com", "https://www.lotexpo.com"];

const json = (req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...createCorsHeaders(req, extra) }
  });

function createCorsHeaders(req: Request, additional: Record<string, string> = {}) {
  const origin = req.headers.get("Origin") || "";
  const requestedHeaders = req.headers.get("Access-Control-Request-Headers") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
    ...additional
  };
  if (req.method === "OPTIONS" && requestedHeaders) {
    const essentials = ["Content-Type", "Authorization", "X-OAuth-State"];
    const requested = requestedHeaders.split(",").map(h => h.trim()).filter(Boolean);
    headers["Access-Control-Allow-Headers"] = Array.from(new Set([...essentials, ...requested])).join(", ");
  } else {
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-OAuth-State";
  }
  return headers;
}

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
    log(req, "preflight");
    return new Response(null, { status: 204, headers: createCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed", stage: "method_validation" }, 405);
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
      return json(req, { 
        code: "CONFIG_MISSING", 
        missing, 
        message: "Configuration OAuth incomplète" 
      }, 500);
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
    const state = await generateSignedState({ userId: userId || "anonymous", timestamp: Date.now() });

    // Construire l'URL d'autorisation HubSpot
    const scopes = "oauth crm.objects.companies.read crm.objects.contacts.read";
    const authUrl = new URL("https://app.hubspot.com/oauth/authorize");
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

    return json(req, {
      installUrl: authUrl.toString(),
      state,
      version: FUNCTION_VERSION
    });

  } catch (error) {
    log(req, "oauth_init_error", { error: String(error) });
    return json(req, { 
      code: "OAUTH_INIT_ERROR", 
      message: String(error) 
    }, 500);
  }
});