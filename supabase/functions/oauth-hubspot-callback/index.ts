import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptJson } from "../_shared/crypto.ts";
import { verifySignedState } from "../_shared/oauth-state.ts";

// Generate secure random claim token
function generateClaimToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/[+/]/g, c => c === '+' ? '-' : '_')
    .replace(/=/g, '');
}

const FUNCTION_VERSION = "2025-08-23-v1";
const ALLOWED_ORIGINS = ["https://lotexpo.com","https://www.lotexpo.com"];

const json = (req: Request, body: unknown, status = 200, extra: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type":"application/json", ...createCorsHeaders(req, extra) }
  });

function createCorsHeaders(req: Request, additional: Record<string,string> = {}) {
  const origin = req.headers.get("Origin") || "";
  const requestedHeaders = req.headers.get("Access-Control-Request-Headers") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers: Record<string,string> = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
    ...additional
  };
  if (req.method === "OPTIONS" && requestedHeaders) {
    const essentials = ["Content-Type","Authorization","X-OAuth-State"];
    const requested = requestedHeaders.split(",").map(h => h.trim()).filter(Boolean);
    headers["Access-Control-Allow-Headers"] = Array.from(new Set([...essentials, ...requested])).join(", ");
  } else {
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-OAuth-State";
  }
  return headers;
}

function log(req: Request, stage: string, data: Record<string,unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    stage, method: req.method, url: req.url,
    origin: req.headers.get("Origin") || "no-origin",
    ua: (req.headers.get("User-Agent") || "").slice(0,120),
    ...data
  };
  console.log(JSON.stringify(entry));
}

serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    log(req,"preflight",{
      acrh: req.headers.get("Access-Control-Request-Headers"),
      acrm: req.headers.get("Access-Control-Request-Method")
    });
    return new Response(null,{ status:204, headers:createCorsHeaders(req) });
  }

  // Diag
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("diag") === "1") {
      const cid = Deno.env.get("HUBSPOT_CLIENT_ID") ?? "";
      return json(req, {
        ok:true, version:FUNCTION_VERSION, now:new Date().toISOString(),
        env:{
          client_id_masked: cid ? cid.replace(/(.{4}).*(.{4})/, "$1...$2") : "",
          redirect_uri: Deno.env.get("HUBSPOT_REDIRECT_URI") ?? "",
          has_client_secret: !!Deno.env.get("HUBSPOT_CLIENT_SECRET"),
          has_encryption_key: !!Deno.env.get("OAUTH_ENC_KEY"),
          has_state_signing_key: !!Deno.env.get("OAUTH_STATE_SIGNING_KEY"),
          has_service_role_key: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        }
      });
    }
    return json(req, { error:"Method not allowed" }, 405);
  }

  if (req.method !== "POST") return json(req,{ error:"Method not allowed", stage:"method_validation" },405);

  try {
    // Parse
    let body: any;
    try { body = await req.json(); }
    catch { return json(req,{ success:false, stage:"body_parsing", message:"invalid_json" },400); }
    const { code, state } = body || {};
    const headerState = req.headers.get("X-OAuth-State") || "";
    if (!code || !state || !headerState)
      return json(req,{ success:false, stage:"validation", message:"missing_params", details:{ hasCode:!!code, hasState:!!state, hasHeader:!!headerState }},400);
    if (state !== headerState)
      return json(req,{ success:false, stage:"csrf_state", message:"state_header_mismatch" },400);

    // Configuration obligatoire - supprimer tous fallbacks pour fail-closed
    const client_id = Deno.env.get("HUBSPOT_CLIENT_ID");
    const client_secret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
    const redirect_uri = Deno.env.get("HUBSPOT_REDIRECT_URI");
    const encryptionKey = Deno.env.get("CRM_ENCRYPTION_KEY");
    const svcRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    
    const missing = [];
    if (!client_id) missing.push("HUBSPOT_CLIENT_ID");
    if (!client_secret) missing.push("HUBSPOT_CLIENT_SECRET");
    if (!redirect_uri) missing.push("HUBSPOT_REDIRECT_URI");
    if (!encryptionKey) missing.push("CRM_ENCRYPTION_KEY");
    if (!svcRole) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl) missing.push("SUPABASE_URL");
    
    if (missing.length > 0) {
      log(req, "config_missing", { missing });
      return json(req, { 
        code: "CONFIG_MISSING", 
        missing, 
        message: "Configuration OAuth incomplète" 
      }, 500);
    }
    if (redirect_uri.includes("/api/oauth/"))
      return json(req,{ success:false, stage:"config_validation", message:"redirect_uri_contains_api_path", expected:"https://lotexpo.com/oauth/hubspot/callback", got:redirect_uri },400);

    // Validation state anti-CSRF obligatoire
    let stateData: any;
    try {
      stateData = await verifySignedState(state);
      log(req, "state_verified", { 
        userId: stateData.userId?.slice(0,8) + "..." || "anonymous" 
      });
    } catch (e) {
      const errorMsg = String((e as any)?.message || e);
      log(req, "state_verification_failed", { error: errorMsg });
      
      if (errorMsg.includes("MISMATCH") || errorMsg.includes("EXPIRED")) {
        return json(req, { 
          code: "STATE_MISMATCH", 
          message: "Session expirée ou état invalide" 
        }, 400);
      }
      return json(req, { 
        code: "STATE_VALIDATION_ERROR", 
        message: errorMsg 
      }, 400);
    }

    // Échange code → tokens avec logging détaillé
    const scopes = "oauth crm.objects.companies.read crm.objects.contacts.read";
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id, client_secret, redirect_uri, code
    });
    
    log(req, "hubspot_token_exchange_start", { 
      usedRedirectUri: redirect_uri,
      scopesUsed: scopes,
      codeLength: code.length
    });
    
    const r = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    
    if (!r.ok) {
      const errorBody = await r.text();
      log(req, "hubspot_token_exchange_failed", { 
        status: r.status, 
        error: errorBody.slice(0, 500),
        usedRedirectUri: redirect_uri,
        scopesUsed: scopes
      });
      
      return json(req, { 
        code: "HUBSPOT_TOKEN_EXCHANGE_FAILED",
        hubspotError: errorBody,
        usedRedirectUri: redirect_uri,
        scopesUsed: scopes,
        message: `Échec d'échange de tokens HubSpot (${r.status})`
      }, 400);
    }
    
    const tokens = await r.json() as { access_token:string; refresh_token?:string; expires_in:number; token_type:string; };

    // Portal id et email (best effort)
    let portal_id: number | null = null;
    let email_from_crm: string | null = null;
    try {
      const info = await fetch("https://api.hubapi.com/oauth/v1/access-tokens/"+tokens.access_token);
      if (info.ok) { 
        const j = await info.json(); 
        if (j?.hub_id) portal_id = Number(j.hub_id); 
        if (j?.user) email_from_crm = j.user;
      }
    } catch {}

    // Chiffrement AES-GCM 256 avec validation de clé
    let access_token_enc = "", refresh_token_enc: string | undefined;
    try {
      // Validation clé de chiffrement (32 bytes après décodage base64)
      const keyBuffer = new Uint8Array(atob(encryptionKey!).split('').map(c => c.charCodeAt(0)));
      if (keyBuffer.length !== 32) {
        log(req, "encryption_key_invalid", { keyLength: keyBuffer.length });
        return json(req, { 
          code: "ENCRYPTION_KEY_INVALID", 
          message: "Clé de chiffrement invalide (doit faire 32 bytes)" 
        }, 500);
      }
      
      access_token_enc = await encryptJson(tokens.access_token);
      if (tokens.refresh_token) refresh_token_enc = await encryptJson(tokens.refresh_token);
      
      log(req, "tokens_encrypted", { 
        accessTokenHash: btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tokens.access_token))))).slice(0,8),
        hasRefreshToken: !!tokens.refresh_token
      });
    } catch (encError) {
      log(req, "encryption_failed", { error: String(encError) });
      return json(req, { 
        code: "ENCRYPTION_FAILED", 
        message: "Échec du chiffrement des tokens" 
      }, 500);
    }
    const expires_at = new Date(Date.now() + (tokens.expires_in*1000)).toISOString();

    // DB upsert (service role → bypass RLS)
    const sb = createClient(supabaseUrl, svcRole, { auth: { persistSession:false }});
    
    // Déterminer le mode en fonction de l'utilisateur
    const isAuthenticated = stateData.userId && stateData.userId !== "anonymous";
    let payload: any;
    let responseData: any;

    if (isAuthenticated) {
      // Utilisateur connecté - attacher directement
      payload = {
        user_id: stateData.userId,
        provider: "hubspot",
        provider_user_id: portal_id?.toString() || null,
        access_token_enc,
        refresh_token_enc,
        expires_at,
        scope: "oauth crm.objects.companies.read crm.objects.contacts.read",
        portal_id,
        email_from_crm,
        status: 'active'
      };
      
      responseData = {
        ok: true,
        success: true,
        mode: "attached",
        provider: "hubspot",
        portal_id,
        version: FUNCTION_VERSION
      };
    } else {
      // Utilisateur anonyme - créer connexion unclaimed
      const claim_token = generateClaimToken();
      const claim_expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h
      
      payload = {
        user_id: null,
        provider: "hubspot",
        provider_user_id: portal_id?.toString() || null,
        access_token_enc,
        refresh_token_enc,
        expires_at,
        scope: "oauth crm.objects.companies.read crm.objects.contacts.read",
        portal_id,
        email_from_crm,
        status: 'unclaimed',
        claim_token,
        claim_token_expires_at: claim_expires_at
      };
      
      responseData = {
        ok: true,
        success: true,
        mode: "unclaimed",
        provider: "hubspot",
        claim_token,
        expires_at: claim_expires_at,
        email_from_crm,
        version: FUNCTION_VERSION
      };
    }

    const { data, error } = await sb.from("crm_connections")
      .insert(payload)
      .select();
      
    if (error) {
      log(req,"store_tokens_failed",{ code:error.code, details:error.details, hint:error.hint });
      return json(req,{ success:false, stage:"store_tokens", db_error:{ code:error.code, details:error.details, hint:error.hint } },500);
    }

    log(req, "oauth_success", { 
      mode: responseData.mode, 
      hasClaimToken: !!responseData.claim_token,
      portal_id 
    });

    return json(req, responseData, 200);
  } catch (e) {
    return json(req,{ success:false, stage:"general", message:String((e as any)?.message || e) },500);
  }
});