// oauth-hubspot-callback (reconstruit, autonome)
// Recoit { code, state } du front, verifie le state signe (HMAC), echange le code
// contre les tokens HubSpot, recupere le portal_id, chiffre les tokens (AES-256-GCM,
// cle CRM_ENCRYPTION_KEY) et ecrit dans crm_connections. Zero dependance _shared.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED = [
  'https://lotexpo.com', 'https://www.lotexpo.com', 'https://lotexpo.fr',
  'https://lotexpo.lovable.app', 'http://localhost:5173', 'http://localhost:3000'
];
function cors(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allow = ALLOWED.includes(origin) ? origin : 'https://lotexpo.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

async function hmac(payload: string, keyStr: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
async function verifySignedState(state: string): Promise<{ userId: string; nonce: string; exp: number }> {
  const key = Deno.env.get('OAUTH_STATE_SIGNING_KEY') || '';
  if (!key) throw new Error('STATE_KEY_MISSING');
  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('STATE_FORMAT');
  const payload = atob(parts[0]);
  const expected = await hmac(payload, key);
  if (parts[1] !== expected) throw new Error('STATE_SIGNATURE');
  const data = JSON.parse(payload);
  if (!data?.userId || Date.now() > data.exp) throw new Error('STATE_EXPIRED');
  return data;
}

async function aesKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get('CRM_ENCRYPTION_KEY') || '';
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('CRM_ENCRYPTION_KEY_INVALID');
  return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
}
async function encryptToken(plain: string): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const ct = new Uint8Array(ctBuf);
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return btoa(String.fromCharCode(...combined));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json(req, { success: false, stage: 'bad_body', message: 'Corps invalide' }, 400); }
  const code = String(body?.code || '').trim();
  const state = String(body?.state || '').trim();
  if (!code) return json(req, { success: false, stage: 'missing_code', message: 'Code manquant' }, 400);
  if (!state) return json(req, { success: false, stage: 'missing_state', message: 'State manquant' }, 400);

  // 1. Verifier le state signe
  let userId: string;
  try {
    const data = await verifySignedState(state);
    userId = data.userId;
  } catch (e) {
    return json(req, { success: false, stage: 'csrf_state', message: 'State invalide: ' + (e instanceof Error ? e.message : String(e)) }, 400);
  }

  const clientId = Deno.env.get('HUBSPOT_CLIENT_ID');
  const clientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET');
  const redirectUri = Deno.env.get('HUBSPOT_REDIRECT_URI');
  if (!clientId || !clientSecret || !redirectUri) {
    const missing = [];
    if (!clientId) missing.push('HUBSPOT_CLIENT_ID');
    if (!clientSecret) missing.push('HUBSPOT_CLIENT_SECRET');
    if (!redirectUri) missing.push('HUBSPOT_REDIRECT_URI');
    return json(req, { success: false, stage: 'config_missing', missing }, 500);
  }

  // 2. Echanger le code contre les tokens
  let tokens: any;
  try {
    const resp = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      })
    });
    const txt = await resp.text();
    if (!resp.ok) return json(req, { success: false, stage: 'token_exchange', status: resp.status, message: txt.slice(0, 300) }, 502);
    tokens = JSON.parse(txt);
  } catch (e) {
    return json(req, { success: false, stage: 'token_exchange', message: String(e) }, 502);
  }

  // 3. Recuperer le portal_id (hub_id) et l email via introspection
  let portalId: number | null = null;
  let emailFromCrm: string | null = null;
  let providerUserId: string | null = null;
  let scopeStr: string | null = null;
  try {
    const info = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + encodeURIComponent(tokens.access_token));
    if (info.ok) {
      const meta = await info.json();
      portalId = typeof meta?.hub_id === 'number' ? meta.hub_id : (meta?.hub_id ? Number(meta.hub_id) : null);
      emailFromCrm = meta?.user || null;
      providerUserId = meta?.user_id ? String(meta.user_id) : null;
      scopeStr = Array.isArray(meta?.scopes) ? meta.scopes.join(' ') : null;
    }
  } catch (_e) { /* introspection non bloquante */ }

  // 4. Chiffrer et stocker dans crm_connections
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const uid = userId === 'anonymous' ? null : userId;
    const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 1800) * 1000).toISOString();

    if (uid) {
      await admin.from('crm_connections').delete().eq('user_id', uid).eq('provider', 'hubspot');
    }
    const { error } = await admin.from('crm_connections').insert({
      user_id: uid,
      provider: 'hubspot',
      access_token_enc: await encryptToken(tokens.access_token),
      refresh_token_enc: tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null,
      expires_at: expiresAt,
      scope: scopeStr,
      portal_id: portalId,
      status: 'active',
      provider_user_id: providerUserId,
      email_from_crm: emailFromCrm
    });
    if (error) return json(req, { success: false, stage: 'store', message: error.message }, 500);
  } catch (e) {
    return json(req, { success: false, stage: 'store', message: String(e) }, 500);
  }

  return json(req, { success: true, provider: 'hubspot', portal_id: portalId });
});
