import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptJson } from "../_shared/crypto.ts";
import { verifySignedState } from "../_shared/oauth-state.ts";

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

    // Secrets
    const client_id = Deno.env.get("HUBSPOT_CLIENT_ID") ?? "";
    const client_secret = Deno.env.get("HUBSPOT_CLIENT_SECRET") ?? "";
    const redirect_uri = Deno.env.get("HUBSPOT_REDIRECT_URI") ?? "";
    const svcRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (!client_id || !client_secret || !redirect_uri || !svcRole || !supabaseUrl)
      return json(req,{ success:false, stage:"config_validation", message:"missing_env" },500);
    if (redirect_uri.includes("/api/oauth/"))
      return json(req,{ success:false, stage:"config_validation", message:"redirect_uri_contains_api_path", expected:"https://lotexpo.com/oauth/hubspot/callback", got:redirect_uri },400);

    // State signé → userId
    let userId = "";
    try {
      const data = await verifySignedState(state); // attend OAUTH_STATE_SIGNING_KEY
      userId = data.userId;
    } catch (e) {
      return json(req,{ success:false, stage:"state_verification", message:String((e as any)?.message || e) },400);
    }

    // Échange code → tokens
    const params = new URLSearchParams({
      grant_type:"authorization_code",
      client_id, client_secret, redirect_uri, code
    });
    const r = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body: params
    });
    if (!r.ok) {
      const t = await r.text();
      log(req,"token_exchange_failed",{ status:r.status, err:t.slice(0,300) });
      return json(req,{ success:false, stage:"token_exchange", hubspot_status:r.status, hubspot_error:t.slice(0,300) },400);
    }
    const tokens = await r.json() as { access_token:string; refresh_token?:string; expires_in:number; token_type:string; };

    // Portal id (best effort)
    let portal_id: number | null = null;
    try {
      const info = await fetch("https://api.hubapi.com/oauth/v1/access-tokens/"+tokens.access_token);
      if (info.ok) { const j = await info.json(); if (j?.hub_id) portal_id = Number(j.hub_id); }
    } catch {}

    // Chiffrement
    let access_token_enc = "", refresh_token_enc: string | undefined;
    try {
      access_token_enc = await encryptJson(tokens.access_token);
      if (tokens.refresh_token) refresh_token_enc = await encryptJson(tokens.refresh_token);
    } catch {
      return json(req,{ success:false, stage:"encryption", message:"failed_to_encrypt" },500);
    }
    const expires_at = new Date(Date.now() + (tokens.expires_in*1000)).toISOString();

    // DB upsert (service role → bypass RLS)
    const sb = createClient(supabaseUrl, svcRole, { auth: { persistSession:false }});
    const payload = {
      user_id: userId,
      provider: "hubspot",
      access_token_enc,
      refresh_token_enc,
      expires_at,
      scope: "oauth crm.objects.companies.read crm.objects.contacts.read",
      portal_id
    };
    const { data, error } = await sb.from("crm_connections")
      .upsert(payload, { onConflict:"user_id,provider", ignoreDuplicates:false })
      .select();
    if (error) {
      log(req,"store_tokens_failed",{ code:error.code, details:error.details, hint:error.hint });
      return json(req,{ success:false, stage:"store_tokens", db_error:{ code:error.code, details:error.details, hint:error.hint } },500);
    }

    return json(req,{ success:true, connected:true, portal_id, version:FUNCTION_VERSION },200);
  } catch (e) {
    return json(req,{ success:false, stage:"general", message:String((e as any)?.message || e) },500);
  }
});