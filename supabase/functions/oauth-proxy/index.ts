
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { code, provider = 'salesforce' } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth configuration from environment
    const clientId = Deno.env.get('OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('OAUTH_CLIENT_SECRET');
    const redirectUri = Deno.env.get('OAUTH_REDIRECT_URI');

    console.log('🔧 OAuth Proxy - Environment check:', { 
      clientId: clientId ? 'set' : 'missing',
      clientSecret: clientSecret ? 'set' : 'missing',
      redirectUri: redirectUri ? 'set' : 'missing'
    });

    // Check if any secrets are placeholder values (mock mode)
    if (!clientId || !clientSecret || !redirectUri || 
        [clientId, clientSecret, redirectUri].includes('placeholder')) {
      console.log('🔧 Mode mock OAuth – pas d\'appel réel');
      return new Response(
        JSON.stringify({ 
          success: true, 
          mock: true, 
          message: 'Mock OK - OAuth proxy is in mock mode',
          provider,
          code: code.substring(0, 10) + '...' // Log partial code for debugging
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Real OAuth flow - Get provider configuration
    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      return new Response(
        JSON.stringify({ success: false, error: `Unsupported provider: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔐 Real OAuth flow for ${provider} - exchanging code for token`);

    // Exchange code for access token
    const tokenResponse = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('OAuth token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    
    console.log('✅ OAuth token exchange successful for', provider);

    // Return the token data
    return new Response(
      JSON.stringify({
        success: true,
        mock: false,
        provider,
        token: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OAuth proxy error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getProviderConfig(provider: string) {
  const configs = {
    salesforce: {
      tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
      scopes: ['api', 'refresh_token'],
    },
    hubspot: {
      tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
      scopes: ['crm.objects.companies.read'],
    },
    pipedrive: {
      tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
      scopes: ['organizations:read'],
    },
    zoho: {
      tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
      scopes: ['ZohoCRM.modules.accounts.READ'],
    },
  };

  return configs[provider as keyof typeof configs];
}
