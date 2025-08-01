import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Récupération des variables d'environnement Zoho
const zohoClientId = Deno.env.get('ZOHO_CLIENT_ID');
const zohoRedirectUri = Deno.env.get('ZOHO_REDIRECT_URI');

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
    
    // Initialize Supabase client for JWT verification
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

    console.log('🔧 Zoho OAuth - Environment check:', { 
      zohoClientId: zohoClientId ? 'set' : 'missing',
      zohoRedirectUri: zohoRedirectUri ? 'set' : 'missing'
    });

    // Check if any secrets are missing or placeholder values (mock mode)
    if (!zohoClientId || !zohoRedirectUri || 
        [zohoClientId, zohoRedirectUri].includes('placeholder')) {
      console.log('🔧 Mode mock Zoho OAuth – pas de secrets configurés');
      return new Response(
        JSON.stringify({ 
          success: true, 
          mock: true, 
          message: 'Mock OK - Zoho OAuth is in mock mode',
          provider: 'zoho'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Real Zoho OAuth - generating install URL');

    // Build the Zoho OAuth installation URL
    const scopes = ['ZohoCRM.modules.accounts.READ'];
    const state = user.id; // Use user ID as state for security
    
    const installUrl = `https://accounts.zoho.com/oauth/v2/auth?` +
      `response_type=code&` +
      `client_id=${zohoClientId}&` +
      `redirect_uri=${encodeURIComponent(zohoRedirectUri)}&` +
      `scope=${encodeURIComponent(scopes.join(','))}&` +
      `access_type=offline&` +
      `state=${state}`;

    console.log('✅ Zoho install URL generated');

    return new Response(
      JSON.stringify({
        installUrl,
        scopes,
        clientId: zohoClientId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    console.error('Zoho OAuth error:', error);
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