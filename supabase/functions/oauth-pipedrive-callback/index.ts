import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Récupération des variables d'environnement Pipedrive
const pipedriveClientId = Deno.env.get('PIPEDRIVE_CLIENT_ID');
const pipedriveClientSecret = Deno.env.get('PIPEDRIVE_CLIENT_SECRET');
const pipedriveRedirectUri = Deno.env.get('PIPEDRIVE_REDIRECT_URI');

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
    // Verify JWT by extracting and validating the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ JWT Auth failed: No valid authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client for JWT verification and database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT by getting user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      console.error('❌ JWT Auth failed:', authError?.message || 'User not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid JWT token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ JWT Auth successful for user:', user.id);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body to get the authorization code
    const { code } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔧 Pipedrive Callback - Environment check:', { 
      pipedriveClientId: pipedriveClientId ? 'set' : 'missing',
      pipedriveClientSecret: pipedriveClientSecret ? 'set' : 'missing',
      pipedriveRedirectUri: pipedriveRedirectUri ? 'set' : 'missing'
    });

    // Check if any secrets are missing or placeholder values (mock mode)
    if (!pipedriveClientId || !pipedriveClientSecret || !pipedriveRedirectUri || 
        [pipedriveClientId, pipedriveClientSecret, pipedriveRedirectUri].includes('placeholder')) {
      console.log('🔧 Mode mock Pipedrive OAuth callback – pas de secrets configurés');
      return new Response(
        JSON.stringify({ 
          success: true, 
          mock: true, 
          message: 'Mock OK - Pipedrive OAuth callback is in mock mode',
          provider: 'pipedrive'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Real Pipedrive OAuth callback - exchanging code for tokens');

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth.pipedrive.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: pipedriveRedirectUri,
        client_id: pipedriveClientId,
        client_secret: pipedriveClientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Pipedrive token exchange failed:', errorText);
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
    
    console.log('✅ Pipedrive token exchange successful');

    // Calculate expiry date (Pipedrive returns expires_in in seconds)
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
      : null;

    // Store tokens in user_crm_connections table
    const { error: dbError } = await supabase
      .from('user_crm_connections')
      .upsert({
        user_id: user.id,
        provider: 'pipedrive',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider'
      });

    if (dbError) {
      console.error('Database error storing Pipedrive tokens:', dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to store tokens',
          details: dbError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Pipedrive tokens stored successfully for user:', user.id);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        provider: 'pipedrive',
        message: 'Pipedrive OAuth connection established successfully'
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

    console.error('Pipedrive OAuth callback error:', error);
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