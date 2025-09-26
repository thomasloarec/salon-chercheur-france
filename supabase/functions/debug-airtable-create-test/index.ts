
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getEnvOrConfig } from '../_shared/airtable-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[debug-airtable-create-test] 🧪 Début test création');
    
    const AIRTABLE_PAT = getEnvOrConfig('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = getEnvOrConfig('AIRTABLE_BASE_ID');
    
    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      return new Response(
        JSON.stringify({ 
          error: 'missing_config',
          message: 'AIRTABLE_PAT ou AIRTABLE_BASE_ID manquant'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Test payload conçu pour provoquer un doublon potentiel
    const testPayload = [
      {
        "exposant_nom": "TEST_DUPLICATE_DETECTION",
        "exposant_email": "test@debug.com",
        "exposant_url": "https://test-debug.com"
      }
    ];

    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/All_Exposants`;

    console.log('[debug-airtable-create-test] 📤 Envoi test payload:', JSON.stringify(testPayload, null, 2));
    console.log('[debug-airtable-create-test] 🌐 URL:', airtableUrl);

    try {
      const response = await fetch(airtableUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          records: testPayload.map(item => ({ fields: item }))
        }),
      });

      const responseBody = await response.text();
      
      console.log('[debug-airtable-create-test] 📨 Status:', response.status);
      console.log('[debug-airtable-create-test] 📨 Body:', responseBody);

      return new Response(
        JSON.stringify({
          success: true,
          test: 'airtable-create-debug',
          payload_sent: testPayload,
          airtable_response: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody
          },
          interpretation: response.status === 422 ? 
            'Erreur 422 détectée - probablement un doublon ou champ manquant' :
            response.status === 200 ? 'Création réussie' :
            `Erreur ${response.status} - voir body pour détails`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (fetchError) {
      console.error('[debug-airtable-create-test] ❌ Erreur fetch:', fetchError);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'fetch_failed',
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          payload_sent: testPayload
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error) {
    console.error('[debug-airtable-create-test] ❌ Erreur générale:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'general_error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
