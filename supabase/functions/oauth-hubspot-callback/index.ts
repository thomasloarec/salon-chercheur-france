import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Récupération des variables d'environnement HubSpot
const hubspotClientId = Deno.env.get('HUBSPOT_CLIENT_ID');
const hubspotClientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET');
const hubspotRedirectUri = Deno.env.get('HUBSPOT_REDIRECT_URI');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 HubSpot callback initiated');

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body to get the authorization code and state
    const { code, state } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Callback parameters:', { code: '***', state, hasState: !!state });

    console.log('🔧 HubSpot Callback - Environment check:', { 
      hubspotClientId: hubspotClientId ? 'set' : 'missing',
      hubspotClientSecret: hubspotClientSecret ? 'set' : 'missing',
      hubspotRedirectUri: hubspotRedirectUri ? 'set' : 'missing'
    });

    // Check if any secrets are missing or placeholder values (mock mode)
    if (!hubspotClientId || !hubspotClientSecret || !hubspotRedirectUri || 
        [hubspotClientId, hubspotClientSecret, hubspotRedirectUri].includes('placeholder')) {
      console.log('🔧 Mode mock HubSpot OAuth callback – pas de secrets configurés');
      return new Response(
        JSON.stringify({ 
          success: true, 
          mock: true, 
          message: 'Mock OK - HubSpot OAuth callback is in mock mode',
          provider: 'hubspot'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Real HubSpot OAuth callback - exchanging code for tokens');

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: hubspotRedirectUri,
        client_id: hubspotClientId,
        client_secret: hubspotClientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('HubSpot token exchange failed:', errorText);
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
    
    console.log('✅ HubSpot token exchange successful');

    // Get user info from HubSpot to extract email
    let userEmail = null;
    try {
      const userInfoResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokenData.access_token);
      if (userInfoResponse.ok) {
        const userInfoData = await userInfoResponse.json();
        userEmail = userInfoData.user_email || userInfoData.user;
        console.log('📧 HubSpot user email:', userEmail ? '***@***.com' : 'not found');
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch HubSpot user info:', error.message);
    }

    // Determine user account handling strategy
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
            error: 'Could not retrieve email from HubSpot. Email is required for account creation.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user with this email already exists
      const { data: existingUsers, error: userSearchError } = await supabase.auth.admin.listUsers();
      
      if (userSearchError) {
        console.error('❌ Error searching for existing users:', userSearchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to check existing users' }),
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
        error: 'Failed to encrypt access token' 
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
          error: 'Failed to encrypt refresh token' 
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
      console.error('Database error storing HubSpot tokens:', dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
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
    // Check if this is a JWT-related error
    if (error.message?.includes('JWT') || error.message?.includes('unauthorized') || error.message?.includes('token')) {
      console.error('❌ JWT Authentication error:', error.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized: JWT authentication failed',
          details: error.message
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('HubSpot OAuth callback error:', error);
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