import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Récupération des variables d'environnement HubSpot
const hubspotAppId = Deno.env.get('HUBSPOT_APP_ID');
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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔧 HubSpot OAuth - Environment check:', { 
      hubspotAppId: hubspotAppId ? 'set' : 'missing',
      hubspotClientId: hubspotClientId ? 'set' : 'missing',
      hubspotClientSecret: hubspotClientSecret ? 'set' : 'missing',
      hubspotRedirectUri: hubspotRedirectUri ? 'set' : 'missing'
    });

    // Check if any secrets are missing or placeholder values (mock mode)
    if (!hubspotAppId || !hubspotClientId || !hubspotClientSecret || !hubspotRedirectUri || 
        [hubspotAppId, hubspotClientId, hubspotClientSecret, hubspotRedirectUri].includes('placeholder')) {
      console.log('🔧 Mode mock HubSpot OAuth – pas de secrets configurés');
      return new Response(
        JSON.stringify({ 
          success: true, 
          mock: true, 
          message: 'Mock OK - HubSpot OAuth is in mock mode',
          provider: 'hubspot'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Real HubSpot OAuth flow - generating install URL');

    // Define HubSpot scopes
    const scopes = ['crm.objects.companies.read', 'crm.objects.contacts.read'];
    
    // Construct OAuth install URL
    const installUrl = `https://app.hubspot.com/oauth/authorize?` +
      `client_id=${hubspotClientId}&` +
      `redirect_uri=${encodeURIComponent(hubspotRedirectUri!)}&` +
      `scope=${scopes.join('%20')}&` +
      `response_type=code&` +
      `state=${user.id}`;

    console.log('✅ HubSpot install URL generated successfully');

    // Return the install URL
    return new Response(
      JSON.stringify({
        success: true,
        mock: false,
        provider: 'hubspot',
        installUrl,
        scopes,
        appId: hubspotAppId
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

    console.error('HubSpot OAuth error:', error);
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