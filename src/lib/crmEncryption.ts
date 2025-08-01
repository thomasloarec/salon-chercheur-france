/**
 * Utility functions for handling encrypted CRM tokens on the client side
 */

import { supabase } from '@/integrations/supabase/client';
import { CrmProvider, CrmConnection } from '@/types/crm';

/**
 * Get decrypted CRM connection for a user and provider
 */
export async function getDecryptedCrmConnection(
  userId: string, 
  provider: CrmProvider
): Promise<CrmConnection | null> {
  // Get encrypted connection data
  const { data: connectionData, error: connectionError } = await supabase
    .from('user_crm_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (connectionError || !connectionData) {
    return null;
  }

  // Use edge function to decrypt tokens securely
  const { data: decryptedData, error: decryptError } = await supabase.functions.invoke('decrypt-crm-tokens', {
    body: {
      access_token_enc: connectionData.access_token_enc,
      refresh_token_enc: connectionData.refresh_token_enc
    }
  });

  if (decryptError || !decryptedData.success) {
    console.error('❌ Error decrypting CRM tokens:', decryptError);
    throw new Error('Failed to decrypt CRM tokens');
  }

  return {
    id: connectionData.id,
    user_id: connectionData.user_id,
    provider: connectionData.provider as CrmProvider,
    access_token: decryptedData.access_token,
    refresh_token: decryptedData.refresh_token,
    expires_at: connectionData.expires_at,
    created_at: connectionData.created_at,
    updated_at: connectionData.updated_at,
  };
}

/**
 * Update encrypted CRM tokens
 */
export async function updateEncryptedCrmTokens(
  userId: string,
  provider: CrmProvider,
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
  }
): Promise<void> {
  // Use edge function to encrypt and store tokens securely
  const { error } = await supabase.functions.invoke('update-crm-tokens', {
    body: {
      user_id: userId,
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at
    }
  });

  if (error) {
    console.error('❌ Error updating encrypted CRM tokens:', error);
    throw new Error('Failed to update encrypted CRM tokens');
  }
}