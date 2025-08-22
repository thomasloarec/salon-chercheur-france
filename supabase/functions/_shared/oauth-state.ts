/**
 * OAuth state signing and verification utilities using HMAC SHA-256
 * Provides cryptographically secure state management for OAuth flows
 */

export interface SignedStateData {
  userId: string;
  nonce: string;
  exp: number;
}

/**
 * Generate HMAC SHA-256 signature for a payload
 */
async function hmac(payload: string, keyStr: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', 
    enc.encode(keyStr), 
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, 
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Create a signed OAuth state containing user ID and expiration
 * Format: base64(payload).hmac_signature
 */
export async function createSignedState(userId: string): Promise<string> {
  const key = Deno.env.get('OAUTH_STATE_SIGNING_KEY') || '';
  if (!key) throw new Error('STATE_KEY_MISSING');
  
  const nonce = crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
  const exp = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
  
  const payload = JSON.stringify({ userId, nonce, exp } satisfies SignedStateData);
  const signature = await hmac(payload, key);
  
  return `${btoa(payload)}.${signature}`;
}

/**
 * Verify a signed OAuth state and extract user data
 * Throws error if signature invalid or expired
 */
export async function verifySignedState(state: string): Promise<SignedStateData> {
  const key = Deno.env.get('OAUTH_STATE_SIGNING_KEY') || '';
  if (!key) throw new Error('STATE_KEY_MISSING');
  
  const [b64, sig] = state.split('.');
  if (!b64 || !sig) throw new Error('STATE_FORMAT');
  
  const payload = atob(b64);
  const expectedSig = await hmac(payload, key);
  
  if (sig !== expectedSig) throw new Error('STATE_SIGNATURE');
  
  const data = JSON.parse(payload) as SignedStateData;
  if (!data?.userId || Date.now() > data.exp) {
    throw new Error('STATE_EXPIRED_OR_INVALID');
  }
  
  return data;
}