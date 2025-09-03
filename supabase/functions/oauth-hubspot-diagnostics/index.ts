import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://lotexpo.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Check all required OAuth HubSpot configuration
    const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
    const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
    const redirectUri = Deno.env.get("HUBSPOT_REDIRECT_URI");
    const encryptionKey = Deno.env.get("CRM_ENCRYPTION_KEY");
    const stateSigningKey = Deno.env.get("OAUTH_STATE_SIGNING_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const diagnostics = {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
      hasEncryptionKey: !!encryptionKey,
      hasStateSigningKey: !!stateSigningKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      // Safe to expose these values
      redirectUri: redirectUri || "NOT_SET",
      expectedScopes: "oauth crm.objects.companies.read crm.objects.contacts.read"
    };

    const allConfigPresent = Object.entries(diagnostics)
      .filter(([key]) => key.startsWith('has'))
      .every(([, value]) => value === true);

    const status = allConfigPresent ? 200 : 500;

    console.log(JSON.stringify({
      stage: "diagnostics_check",
      allConfigPresent,
      details: diagnostics
    }));

    return new Response(
      JSON.stringify({
        success: allConfigPresent,
        message: allConfigPresent 
          ? "Configuration OAuth HubSpot complète" 
          : "Configuration OAuth HubSpot incomplète",
        ...diagnostics,
        timestamp: new Date().toISOString()
      }),
      { 
        status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in oauth-hubspot-diagnostics:', error);
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