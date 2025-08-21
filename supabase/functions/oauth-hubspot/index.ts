import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Récupération des variables d'environnement HubSpot
const hubspotAppId = Deno.env.get('HUBSPOT_APP_ID');
const hubspotClientId = Deno.env.get('HUBSPOT_CLIENT_ID');
const hubspotClientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET');
const hubspotRedirectUri = Deno.env.get('HUBSPOT_REDIRECT_URI') || 'https://lotexpo.com/oauth/hubspot/callback';
// Configuration du domaine HubSpot (US vs EU)
const hubspotDomain = Deno.env.get('HUBSPOT_DOMAIN') || 'app.hubspot.com'; // par défaut US

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
    // Parse URL pour récupérer les query params (notamment oauthDebug)
    const url = new URL(req.url);
    const oauthDebug = url.searchParams.get('oauthDebug') === '1';
    
    console.log(`🔄 OAuth HubSpot request: ${req.method} ${req.url}`);
    if (oauthDebug) {
      console.log('🔍 [DEBUG MODE] Mode debug OAuth activé');
    }
    
    // Optional JWT verification - allow both authenticated and unauthenticated users
    const authHeader = req.headers.get('authorization');
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '');
      
      // Initialize Supabase client for JWT verification
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Try to verify the JWT
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
      
      if (!authError && user) {
        userId = user.id;
        console.log('✅ JWT Auth successful for user:', user.id);
      } else {
        console.log('⚠️ JWT Auth failed, proceeding without authentication:', authError?.message);
      }
    } else {
      console.log('🔓 No JWT provided, proceeding with unauthenticated flow');
    }

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
      hubspotRedirectUri: hubspotRedirectUri ? 'set' : 'missing',
      hubspotDomain: hubspotDomain
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

    // Define HubSpot scopes (oauth est obligatoire selon HubSpot)
    const requiredScopes = ['oauth', 'crm.objects.companies.read', 'crm.objects.contacts.read'];
    const optionalScopes: string[] = []; // Ajoutez d'autres scopes ici si nécessaire
    
    // Combiner tous les scopes
    const allScopes = [...requiredScopes, ...optionalScopes];
    
    // Construct OAuth install URL
    // Use userId if available, otherwise generate a temporary state for unauthenticated users
    const state = userId || `unauth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const installUrl = `https://${hubspotDomain}/oauth/authorize?` +
      `client_id=${hubspotClientId}&` +
      `redirect_uri=${encodeURIComponent(hubspotRedirectUri!)}&` +
      `scope=${allScopes.join('%20')}&` +
      `response_type=code&` +
      `state=${state}`;

    // 🔍 LOGGING pour debug : afficher l'URL OAuth construite
    const debugInfo = {
      domain: hubspotDomain,
      clientId: hubspotClientId,
      redirectUri: hubspotRedirectUri,
      requiredScopes,
      optionalScopes,
      fullUrl: oauthDebug ? installUrl : '[URL masquée - utilisez ?oauthDebug=1 pour afficher]'
    };
    
    if (oauthDebug) {
      console.log('🔍 [DEBUG MODE] HubSpot OAuth URL construite:', debugInfo);
    } else {
      console.log('🔍 HubSpot OAuth URL construite:', {
        ...debugInfo,
        fullUrl: '[URL masquée - utilisez ?oauthDebug=1 pour afficher]'
      });
    }

    console.log('✅ HubSpot install URL generated successfully');

    // Return the install URL
    return new Response(
      JSON.stringify({
        success: true,
        mock: false,
        provider: 'hubspot',
        installUrl,
        scopes: allScopes,
        requiredScopes,
        optionalScopes,
        appId: hubspotAppId,
        domain: hubspotDomain,
        debug: oauthDebug ? { fullUrl: installUrl } : undefined
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