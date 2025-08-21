import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Récupération des variables d'environnement HubSpot
const hubspotClientId = Deno.env.get('HUBSPOT_CLIENT_ID');
const hubspotClientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET');
const hubspotRedirectUri = Deno.env.get('HUBSPOT_REDIRECT_URI');
const hubspotDomain = Deno.env.get('HUBSPOT_DOMAIN') || 'app.hubspot.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://lotexpo.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    // 🔄 STAGE 1: Initialization
    console.log('🔄 HubSpot callback initiated');
    console.log('📊 Request details:', {
      method: req.method,
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
      userAgent: req.headers.get('user-agent')?.substring(0, 50) + '...'
    });

    // Log environment variables presence (not values)
    console.log('🔧 Environment check:', {
      hubspotClientId: hubspotClientId ? 'set' : 'missing',
      hubspotClientSecret: hubspotClientSecret ? 'set' : 'missing', 
      hubspotRedirectUri: hubspotRedirectUri ? 'set' : 'missing',
      hubspotDomain: hubspotDomain
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== 'POST') {
      console.log('❌ Invalid method:', req.method);
      return new Response(
        JSON.stringify({ 
          success: false, 
          stage: 'method_validation',
          error: 'Method not allowed. Only POST is accepted.',
          details: `Received ${req.method}, expected POST`
        }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔄 STAGE 2: Input validation
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.log('❌ JSON parse error:', parseError.message);
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'input_validation', 
          error: 'Invalid JSON payload',
          details: parseError.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { code, state, provider } = requestBody;

    console.log('📋 Callback parameters:', { 
      code: code ? '***' : 'missing', 
      state: state ? '***' : 'missing', 
      provider: provider || 'not specified',
      hasState: !!state 
    });

    // Input validation
    if (!code || typeof code !== 'string' || code.trim() === '') {
      console.log('❌ Invalid or missing code');
      return new Response(
        JSON.stringify({ 
          success: false, 
          stage: 'input_validation',
          error: 'Authorization code is required',
          details: 'Code parameter is missing, empty, or not a string'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (code === 'TEST') {
      console.log('🧪 Test code detected - returning validation success');
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'input_validation',
          error: 'Test code detected',
          details: 'Code "TEST" is for testing purposes only and will not work with HubSpot API'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!state) {
      console.log('⚠️ Missing state parameter - proceeding with unauthenticated flow');
    }

    // 🔄 STAGE 3: Environment validation
    if (!hubspotClientId || !hubspotClientSecret || !hubspotRedirectUri || 
        [hubspotClientId, hubspotClientSecret, hubspotRedirectUri].includes('placeholder')) {
      console.log('🔧 Mock mode - secrets not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          stage: 'environment_validation',
          mock: true, 
          error: 'HubSpot OAuth is in mock mode',
          details: 'Required secrets (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI) are missing or placeholder'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Real HubSpot OAuth callback - exchanging code for tokens');
    
    // 🔄 STAGE 4: Token exchange
    const tokenExchangeUrl = 'https://api.hubapi.com/oauth/v1/token';
    console.log('🌐 Token exchange URL:', tokenExchangeUrl);

    let tokenResponse;
    let tokenData;
    
    try {
      // Exchange authorization code for access token
      tokenResponse = await fetch(tokenExchangeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: hubspotRedirectUri!,
          client_id: hubspotClientId!,
          client_secret: hubspotClientSecret!,
        }),
      });

      console.log('📡 HubSpot API response:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        ok: tokenResponse.ok
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { raw: errorText };
        }
        
        console.error('❌ HubSpot token exchange failed:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorDetails
        });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            stage: 'token_exchange',
            error: `Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`,
            details: errorDetails
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tokenData = await tokenResponse.json();
      
    } catch (fetchError) {
      console.error('❌ Network error during token exchange:', fetchError.message);
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'token_exchange', 
          error: 'Network error during token exchange',
          details: fetchError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ HubSpot token exchange successful');

    // 🔄 STAGE 5: User info retrieval
    let userEmail = null;
    try {
      const userInfoResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokenData.access_token);
      if (userInfoResponse.ok) {
        const userInfoData = await userInfoResponse.json();
        userEmail = userInfoData.user_email || userInfoData.user;
        console.log('📧 HubSpot user email:', userEmail ? '***@***.com' : 'not found');
      } else {
        console.warn('⚠️ HubSpot user info request failed:', userInfoResponse.status);
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch HubSpot user info:', error.message);
    }

    // 🔄 STAGE 6: User account handling
    let finalUserId = null;
    
    // Check if state contains a valid user ID (existing authenticated user)
    if (state && !state.startsWith('unauth_')) {
      // Authenticated flow - use the user ID from state
      finalUserId = state;
      console.log('👤 Authenticated user flow, user ID:', finalUserId);
    } else {
      // Unauthenticated flow - need to create or find user
      console.log('🆕 Unauthenticated user flow, need to handle account creation/linking');
      
      if (!userEmail) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            stage: 'user_handling',
            error: 'Could not retrieve email from HubSpot. Email is required for account creation.',
            details: 'HubSpot user info API did not return a valid email address'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user with this email already exists
      const { data: existingUsers, error: userSearchError } = await supabase.auth.admin.listUsers();
      
      if (userSearchError) {
        console.error('❌ Error searching for existing users:', userSearchError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            stage: 'user_handling',
            error: 'Failed to check existing users',
            details: userSearchError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const existingUser = existingUsers.users.find(u => u.email === userEmail);
      
      if (existingUser) {
        // User exists - link CRM connection to existing account
        finalUserId = existingUser.id;
        console.log('🔗 Linking HubSpot to existing user:', finalUserId);
      } else {
        // Create new user account
        const { data: newUserData, error: createUserError } = await supabase.auth.admin.createUser({
          email: userEmail,
          email_confirm: true,
          user_metadata: {
            hubspot_connected: true,
            connected_via: 'hubspot_oauth'
          }
        });

        if (createUserError || !newUserData.user) {
          console.error('❌ Error creating new user:', createUserError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              stage: 'user_creation',
              error: 'Failed to create user account',
              details: createUserError?.message 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        finalUserId = newUserData.user.id;
        console.log('🎉 Created new user account:', finalUserId);
      }
    }

    // 🔄 STAGE 7: Token encryption and storage
    // Calculate expiry date (HubSpot returns expires_in in seconds)
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
      : null;

    // Store encrypted tokens in user_crm_connections table
    const encryptionKey = Deno.env.get('CRM_ENCRYPTION_KEY') || 'dev-encryption-key-change-in-production';
    
    // Encrypt tokens using pgcrypto
    const { data: encryptedAccessToken, error: encryptError1 } = await supabase.rpc('pgp_sym_encrypt', {
      data: tokenData.access_token,
      psw: encryptionKey
    });
    
    if (encryptError1) {
      console.error('❌ Error encrypting access token:', encryptError1);
      return new Response(JSON.stringify({ 
        success: false, 
        stage: 'token_encryption',
        error: 'Failed to encrypt access token',
        details: encryptError1.message
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      });
    }

    let encryptedRefreshToken = null;
    if (tokenData.refresh_token) {
      const { data: encRefreshToken, error: encryptError2 } = await supabase.rpc('pgp_sym_encrypt', {
        data: tokenData.refresh_token,
        psw: encryptionKey
      });
      
      if (encryptError2) {
        console.error('❌ Error encrypting refresh token:', encryptError2);
        return new Response(JSON.stringify({ 
          success: false, 
          stage: 'token_encryption',
          error: 'Failed to encrypt refresh token',
          details: encryptError2.message
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        });
      }
      encryptedRefreshToken = encRefreshToken;
    }

    const { error: dbError } = await supabase
      .from('user_crm_connections')
      .upsert({
        user_id: finalUserId,
        provider: 'hubspot',
        access_token_enc: encryptedAccessToken,
        refresh_token_enc: encryptedRefreshToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider'
      });

    if (dbError) {
      console.error('❌ Database error storing HubSpot tokens:', dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          stage: 'database_storage',
          error: 'Failed to store tokens',
          details: dbError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ HubSpot tokens stored successfully for user:', finalUserId);

    // Return success response with user information
    return new Response(
      JSON.stringify({
        success: true,
        provider: 'hubspot',
        message: 'HubSpot OAuth connection established successfully',
        user_id: finalUserId,
        email: userEmail,
        was_created: !state || state.startsWith('unauth_')
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Global error handler with stage information
    console.error('❌ Unexpected error in HubSpot OAuth callback:', error);
    
    // Check if this is a JWT-related error
    if (error.message?.includes('JWT') || error.message?.includes('unauthorized') || error.message?.includes('token')) {
      console.error('❌ JWT Authentication error:', error.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          stage: 'authentication',
          error: 'Unauthorized: JWT authentication failed',
          details: error.message
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generic server error
    return new Response(
      JSON.stringify({ 
        success: false, 
        stage: 'unknown',
        error: 'Internal server error',
        details: error.message || 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});