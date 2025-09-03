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
        code: "AUTH_REQUIRED", 
        message: "Authentification requise" 
      }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Vérifier la session utilisateur
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ 
        code: "CONFIG_MISSING", 
        message: "Configuration Supabase manquante" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      log(req, "auth_invalid", { error: authError?.message });
      return new Response(JSON.stringify({ 
        code: "SESSION_INVALID", 
        message: "Session utilisateur invalide" 
      }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Configuration AWS
    const awsCrmApiUrl = Deno.env.get("AWS_CRM_API_URL");
    const awsCrmApiKey = Deno.env.get("AWS_CRM_API_KEY");
    
    if (!awsCrmApiUrl) {
      log(req, "aws_config_missing");
      return new Response(JSON.stringify({ 
        code: "AWS_CONFIG_MISSING", 
        message: "Configuration AWS API manquante" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Parser et forwarder la requête
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

    // Gérer le ping local pour tests
    if (body?.ping === "ok") {
      return new Response(JSON.stringify({ pong: true, version: FUNCTION_VERSION }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
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
      
      return new Response(JSON.stringify({
        code: "AWS_PROXY_ERROR",
        status: awsResponse.status,
        message: "Erreur depuis l'API backend",
        bodyExcerpt: awsResponseText.slice(0, 500)
      }), {
        status: awsResponse.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(req) }
      });
    }

    // Succès - retourner la réponse AWS
    return new Response(JSON.stringify(awsResponseJson), {
      status: awsResponse.status,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) }
    });

  } catch (error) {
    log(req, "proxy_error", { error: String(error) });
    return new Response(JSON.stringify({ 
      code: "PROXY_ERROR", 
      message: String(error) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) }
    });
  }
});