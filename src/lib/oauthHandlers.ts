
import { getOAuthConfig, createOAuthClient } from '@/lib/oauth';
import { supabase } from '@/integrations/supabase/client';
import { syncCrmAccounts } from '@/lib/syncCrmAccounts';
import { CrmProvider } from '@/types/crm';
import dayjs from 'dayjs';

export async function handleOAuthLogin(provider: CrmProvider) {
  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Validate provider
    if (!['salesforce', 'hubspot', 'pipedrive', 'zoho'].includes(provider)) {
      throw new Error('Invalid provider');
    }

    // Get OAuth configuration
    const config = getOAuthConfig(provider);
    const client = createOAuthClient(config);
    
    // Build redirect URI
    const baseUrl = window.location.origin;
    const redirectUri = `${baseUrl}/crm-integrations?callback=${provider}`;
    
    // Generate authorization URL
    const authUrl = client.authorizeURL({
      redirect_uri: redirectUri,
      scope: config.scopes.join(' '),
      state: user.id, // Use user ID as state for security
      ...config.extraAuthParams,
    });

    // Redirect to OAuth provider
    window.location.href = authUrl;
    
  } catch (error) {
    console.error(`OAuth login error for ${provider}:`, error);
    throw error;
  }
}

export async function handleOAuthCallback(provider: CrmProvider, code: string, state: string) {
  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Validate required parameters
    if (!code || state !== user.id) {
      throw new Error('Invalid callback parameters');
    }

    // Get OAuth configuration and client
    const config = getOAuthConfig(provider);
    const client = createOAuthClient(config);
    
    // Build redirect URI
    const baseUrl = window.location.origin;
    const redirectUri = `${baseUrl}/crm-integrations?callback=${provider}`;

    // Exchange code for tokens
    const tokenParams = {
      code,
      redirect_uri: redirectUri,
      scope: config.scopes.join(' '),
    };

    const accessToken = await client.getToken(tokenParams);
    const token = accessToken.token;

    // Calculate expiration time
    const expiresAt = token.expires_in 
      ? dayjs().add(token.expires_in, 'seconds').toISOString()
      : null;

    // Upsert connection in database
    const { error: dbError } = await supabase
      .from('user_crm_connections')
      .upsert({
        user_id: user.id,
        provider,
        access_token: token.access_token,
        refresh_token: token.refresh_token || null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
        ignoreDuplicates: false,
      });

    if (dbError) {
      console.error('Database error saving CRM connection:', dbError);
      throw new Error('Failed to save connection');
    }

    // Trigger initial sync
    try {
      await syncCrmAccounts(user.id, provider);
    } catch (syncError) {
      console.error(`Initial sync failed for ${provider}:`, syncError);
      // Don't fail the connection if sync fails
    }

    return { success: true };

  } catch (error) {
    console.error(`OAuth callback error for ${provider}:`, error);
    throw error;
  }
}

export async function handleDisconnectCrm(provider: CrmProvider) {
  try {
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Validate provider
    if (!['salesforce', 'hubspot', 'pipedrive', 'zoho'].includes(provider)) {
      throw new Error('Invalid provider');
    }

    // Delete CRM connection
    const { error } = await supabase
      .from('user_crm_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (error) {
      console.error('Database error deleting CRM connection:', error);
      throw new Error('Failed to delete connection');
    }

    return { success: true };

  } catch (error) {
    console.error(`Delete connection error for ${provider}:`, error);
    throw error;
  }
}
