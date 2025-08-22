import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { encryptJson } from '../_shared/crypto.ts';
import { verifySignedState } from '../_shared/oauth-state.ts';

const json = (body: unknown, init: ResponseInit = {}) => 
  new Response(JSON.stringify(body), { 
    ...init, 
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...init.headers }
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders });
  }

  // GET ?diag=1
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('diag') === '1') {
      const cid = Deno.env.get('HUBSPOT_CLIENT_ID') ?? '';
      return json({ 
        ok: true, 
        env: {
          client_id_masked: cid ? cid.replace(/(.{4}).*(.{4})/, '$1...$2') : '',
          redirect_uri: Deno.env.get('HUBSPOT_REDIRECT_URI') ?? '',
          has_client_secret: !!Deno.env.get('HUBSPOT_CLIENT_SECRET'),
          has_encryption_key: !!Deno.env.get('OAUTH_ENC_KEY'),
          has_state_signing_key: !!Deno.env.get('OAUTH_STATE_SIGNING_KEY'),
          has_service_role_key: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        }
      });
    }
  }

  try {

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const { code, state } = await req.json();
    const oauthHeader = req.headers.get('X-OAuth-State') || '';
    
    if (!code || !state || !oauthHeader) {
      return json({ 
        success: false, 
        stage: 'validation', 
        message: 'missing_params', 
        details: { hasCode: !!code, hasState: !!state, hasHeader: !!oauthHeader }
      }, { status: 400 });
    }
    
    if (oauthHeader !== state) {
      return json({ 
        success: false, 
        stage: 'csrf_state', 
        message: 'state_header_mismatch' 
      }, { status: 400 });
    }

    // State signé → user_id
    let userId = '';
    try {
      const data = await verifySignedState(state);
      userId = data.userId;
    } catch (e) {
      return json({ 
        success: false, 
        stage: 'state_verification', 
        message: String(e?.message || e) 
      }, { status: 400 });
    }

    const client_id = Deno.env.get('HUBSPOT_CLIENT_ID') ?? '';
    const client_secret = Deno.env.get('HUBSPOT_CLIENT_SECRET') ?? '';
    const redirect_uri = Deno.env.get('HUBSPOT_REDIRECT_URI') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!client_id || !client_secret || !redirect_uri || !supabaseServiceKey || !supabaseUrl) {
      return json({ 
        success: false, 
        stage: 'config_validation', 
        message: 'missing_env' 
      }, { status: 500 });
    }

    // Token exchange
    const params = new URLSearchParams({
      grant_type: 'authorization_code', 
      client_id, 
      client_secret, 
      redirect_uri, 
      code
    });
    
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
      body: params
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return json({ 
        success: false, 
        stage: 'token_exchange', 
        hubspot_status: tokenResponse.status, 
        hubspot_error: errorText.slice(0, 300) 
      }, { status: 400 });
    }
    
    const tokens = await tokenResponse.json() as { 
      access_token: string; 
      refresh_token?: string; 
      expires_in: number; 
      token_type: string; 
    };

    // Optionnel: récupérer portal_id
    let portal_id: number | null = null;
    try {
      const infoResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokens.access_token);
      if (infoResponse.ok) { 
        const infoData = await infoResponse.json(); 
        if (infoData?.hub_id) portal_id = Number(infoData.hub_id); 
      }
    } catch {
      // Portal ID retrieval is optional
    }

    // Chiffrement
    let access_token_enc = '', refresh_token_enc: string | undefined;
    try {
      access_token_enc = await encryptJson(tokens.access_token);
      if (tokens.refresh_token) refresh_token_enc = await encryptJson(tokens.refresh_token);
    } catch {
      return json({ 
        success: false, 
        stage: 'encryption', 
        message: 'failed_to_encrypt' 
      }, { status: 500 });
    }

    const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Service role client (bypass RLS pour INSERT)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false }});
    
    const payload = {
      user_id: userId, 
      provider: 'hubspot',
      access_token_enc, 
      refresh_token_enc, 
      expires_at,
      scope: 'oauth crm.objects.companies.read crm.objects.contacts.read',
      portal_id
    };
    
    const { data, error } = await supabase.from('crm_connections')
      .upsert(payload, { onConflict: 'user_id,provider', ignoreDuplicates: false })
      .select();
      
    if (error) {
      return json({ 
        success: false, 
        stage: 'store_tokens', 
        db_error: { 
          code: error.code, 
          message: error.message, 
          details: error.details, 
          hint: error.hint 
        } 
      }, { status: 500 });
    }

    return json({ 
      success: true, 
      connected: true, 
      portal_id 
    }, { status: 200 });

  } catch (e) {
    return json({ 
      success: false, 
      stage: 'general', 
      message: String(e?.message || e) 
    }, { status: 500 });
  }
});