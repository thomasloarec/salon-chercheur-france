
import { supabase } from '@/integrations/supabase/client';
import { CrmProvider } from '@/types/crm';

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
    
    // Build redirect URI
    const baseUrl = window.location.origin;
    const redirectUri = `${baseUrl}/crm-integrations?callback=${provider}`;
    
    // Generate authorization URL
    const authUrl = buildAuthUrl(config, redirectUri, user.id);

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

    console.log(`🔄 Processing OAuth callback for ${provider}`);

    // Use the OAuth proxy to exchange code for token
    const { data, error: functionError } = await supabase.functions.invoke('oauth-proxy', {
      body: { code, provider }
    });

    if (functionError) {
      throw new Error(`OAuth proxy error: ${functionError.message}`);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'OAuth exchange failed');
    }

    // Handle mock mode
    if (data.mock) {
      console.log('🔧 OAuth callback completed in mock mode');
      return { success: true, mock: true };
    }

    // Real OAuth flow - save token to database
    const token = data.token;
    if (!token?.access_token) {
      throw new Error('No access token received');
    }

    // Calculate expiration time
    const expiresAt = token.expires_in 
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
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

    console.log('✅ OAuth callback completed successfully');
    return { success: true, mock: false };

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

function getOAuthConfig(provider: CrmProvider) {
  const configs = {
    salesforce: {
      authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
      scopes: ['api', 'refresh_token'],
    },
    hubspot: {
      authUrl: 'https://app.hubspot.com/oauth/authorize',
      scopes: ['crm.objects.companies.read'],
    },
    pipedrive: {
      authUrl: 'https://oauth.pipedrive.com/oauth/authorize',
      scopes: ['organizations:read'],
    },
    zoho: {
      authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
      scopes: ['ZohoCRM.modules.accounts.READ'],
      extraParams: { access_type: 'offline' },
    },
  };

  return configs[provider];
}

function buildAuthUrl(config: any, redirectUri: string, userId: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'placeholder', // Will be handled by the Edge Function
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    state: userId,
    ...config.extraParams,
  });

  return `${config.authUrl}?${params.toString()}`;
}
