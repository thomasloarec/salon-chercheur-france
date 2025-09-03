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
        code: "AUTH_REQUIRED", 
        message: "Authentification requise" 
      }, 401);
    }

    // Vérifier la session utilisateur
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !anonKey) {
      return json(req, { 
        code: "CONFIG_MISSING", 
        message: "Configuration Supabase manquante" 
      }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      log(req, "auth_invalid", { error: authError?.message });
      return json(req, { 
        code: "SESSION_INVALID", 
        message: "Session utilisateur invalide" 
      }, 401);
    }

    // Configuration AWS
    const awsCrmApiUrl = Deno.env.get("AWS_CRM_API_URL");
    const awsCrmApiKey = Deno.env.get("AWS_CRM_API_KEY");
    
    if (!awsCrmApiUrl) {
      log(req, "aws_config_missing");
      return json(req, { 
        code: "AWS_CONFIG_MISSING", 
        message: "Configuration AWS API manquante" 
      }, 500);
    }

    // Parser et forwarder la requête
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(req, { 
        code: "INVALID_JSON", 
        message: "Corps de requête JSON invalide" 
      }, 400);
    }

    log(req, "proxy_request_start", { 
      targetUrl: awsCrmApiUrl,
      userId: user.id.slice(0, 8) + "...",
      hasApiKey: !!awsCrmApiKey
    });

    // TODO: Configuration CORS attendue côté API Gateway AWS:
    // - Origin: https://lotexpo.com
    // - Methods: POST, OPTIONS  
    // - Headers: Authorization, Content-Type
    // - Response Headers: Access-Control-Allow-Origin, Access-Control-Allow-Headers, Access-Control-Allow-Methods, Vary: Origin

    // Préparer les headers pour AWS
    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Ajouter l'API key AWS si disponible, sinon forwarder le JWT
    if (awsCrmApiKey) {
      forwardHeaders["x-api-key"] = awsCrmApiKey;
    } else {
      forwardHeaders["Authorization"] = authHeader;
    }

    // Appeler l'API AWS
    const awsResponse = await fetch(awsCrmApiUrl, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(body)
    });

    const awsResponseText = await awsResponse.text();
    let awsResponseJson: any;
    
    try {
      awsResponseJson = JSON.parse(awsResponseText);
    } catch {
      awsResponseJson = { message: awsResponseText };
    }

    log(req, "proxy_response", { 
      awsStatus: awsResponse.status,
      awsOk: awsResponse.ok,
      responseSize: awsResponseText.length
    });

    if (!awsResponse.ok) {
      log(req, "aws_error_response", { 
        status: awsResponse.status,
        bodyExcerpt: awsResponseText.slice(0, 500)
      });
      
      return json(req, {
        code: "AWS_PROXY_ERROR",
        status: awsResponse.status,
        message: "Erreur depuis l'API backend",
        bodyExcerpt: awsResponseText.slice(0, 500)
      }, awsResponse.status);
    }

    // Succès - retourner la réponse AWS
    return json(req, awsResponseJson, awsResponse.status);

  } catch (error) {
    log(req, "proxy_error", { error: String(error) });
    return json(req, { 
      code: "PROXY_ERROR", 
      message: String(error) 
    }, 500);
  }
});