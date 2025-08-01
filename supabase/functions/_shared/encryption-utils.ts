/**
 * Utility functions for encrypting and decrypting CRM tokens
 * Uses pgcrypto extension with symmetric encryption
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create a service role client for encryption operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Get the encryption key from environment variables
 * Falls back to a default key for development/testing
 */
export function getEncryptionKey(): string {
  const key = Deno.env.get('CRM_ENCRYPTION_KEY');
  if (!key) {
    console.warn('⚠️ CRM_ENCRYPTION_KEY not found in environment, using default key');
    return 'dev-encryption-key-change-in-production';
  }
  return key;
}

/**
 * Encrypt a token using pgcrypto
 */
export async function encryptToken(token: string): Promise<Uint8Array> {
  const encryptionKey = getEncryptionKey();
  
  const { data, error } = await supabase.rpc('pgp_sym_encrypt', {
    data: token,
    psw: encryptionKey
  });

  if (error) {
    console.error('❌ Encryption error:', error);
    throw new Error(`Failed to encrypt token: ${error.message}`);
  }

  return data;
}

/**
 * Decrypt a token using pgcrypto
 */
export async function decryptToken(encryptedToken: Uint8Array): Promise<string> {
  const encryptionKey = getEncryptionKey();
  
  const { data, error } = await supabase.rpc('pgp_sym_decrypt', {
    data: encryptedToken,
    psw: encryptionKey
  });

  if (error) {
    console.error('❌ Decryption error:', error);
    throw new Error(`Failed to decrypt token: ${error.message}`);
  }

  return data;
}

/**
 * Store encrypted CRM connection tokens
 */
export async function storeEncryptedConnection(connection: {
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
}) {
  const encryptedAccessToken = await encryptToken(connection.access_token);
  const encryptedRefreshToken = connection.refresh_token 
    ? await encryptToken(connection.refresh_token)
    : null;

  const { error } = await supabase
    .from('user_crm_connections')
    .upsert({
      user_id: connection.user_id,
      provider: connection.provider,
      access_token_enc: encryptedAccessToken,
      refresh_token_enc: encryptedRefreshToken,
      expires_at: connection.expires_at,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider'
    });

  if (error) {
    console.error('❌ Error storing encrypted connection:', error);
    throw new Error(`Failed to store encrypted connection: ${error.message}`);
  }
}

/**
 * Retrieve and decrypt CRM connection tokens
 */
export async function getDecryptedConnection(userId: string, provider: string) {
  const { data, error } = await supabase
    .from('user_crm_connections')
    .select('access_token_enc, refresh_token_enc, expires_at, created_at, updated_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error) {
    console.error('❌ Error fetching encrypted connection:', error);
    throw new Error(`Failed to fetch encrypted connection: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const accessToken = await decryptToken(data.access_token_enc);
  const refreshToken = data.refresh_token_enc 
    ? await decryptToken(data.refresh_token_enc)
    : null;

  return {
    user_id: userId,
    provider,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: data.expires_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Update encrypted tokens for an existing connection
 */
export async function updateEncryptedTokens(
  userId: string, 
  provider: string, 
  tokens: { access_token: string; refresh_token?: string; expires_at?: string }
) {
  const encryptedAccessToken = await encryptToken(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token 
    ? await encryptToken(tokens.refresh_token)
    : null;

  const { error } = await supabase
    .from('user_crm_connections')
    .update({
      access_token_enc: encryptedAccessToken,
      refresh_token_enc: encryptedRefreshToken,
      expires_at: tokens.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    console.error('❌ Error updating encrypted tokens:', error);
    throw new Error(`Failed to update encrypted tokens: ${error.message}`);
  }
}