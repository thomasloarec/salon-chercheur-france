import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Récupération des variables d'environnement Salesforce
const salesforceClientId = Deno.env.get('SALESFORCE_CLIENT_ID');
const salesforceRedirectUri = Deno.env.get('SALESFORCE_REDIRECT_URI');

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

    console.log('🔧 Salesforce OAuth - Environment check:', { 
      salesforceClientId: salesforceClientId ? 'set' : 'missing',
      salesforceRedirectUri: salesforceRedirectUri ? 'set' : 'missing'
    });

    // Check if any secrets are missing or placeholder values (mock mode)
    if (!salesforceClientId || !salesforceRedirectUri || 
        [salesforceClientId, salesforceRedirectUri].includes('placeholder')) {
      console.log('🔧 Mode mock Salesforce OAuth – pas de secrets configurés');
      return new Response(
        JSON.stringify({ 
          success: true, 
          mock: true, 
          message: 'Mock OK - Salesforce OAuth is in mock mode',
          provider: 'salesforce'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Real Salesforce OAuth - generating install URL');

    // Build the Salesforce OAuth installation URL
    const scopes = ['api', 'refresh_token'];
    const state = user.id; // Use user ID as state for security
    
    const installUrl = `https://login.salesforce.com/services/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${salesforceClientId}&` +
      `redirect_uri=${encodeURIComponent(salesforceRedirectUri)}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `state=${state}`;

    console.log('✅ Salesforce install URL generated');

    return new Response(
      JSON.stringify({
        installUrl,
        scopes,
        clientId: salesforceClientId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Check if this is a JWT-related error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage?.includes('JWT') || errorMessage?.includes('unauthorized') || errorMessage?.includes('token')) {
      console.error('❌ JWT Authentication error:', errorMessage);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized: JWT authentication failed',
          details: errorMessage
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('Salesforce OAuth error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});