
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    console.log('[airtable-read] 🔍 Début de la requête de lecture');

    const url = new URL(req.url);
    const table = url.searchParams.get('table');

    if (!table) {
      return new Response(
        JSON.stringify({ success: false, error: 'Table parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      console.error('[airtable-read] ❌ Variables manquantes');
      return new Response(
        JSON.stringify({ success: false, error: 'missing_env', missing: ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID'] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[airtable-read] 📋 Lecture table: ${table}`);
    console.log(`[airtable-read] 🔑 PAT présente: OUI (***${AIRTABLE_PAT.slice(-4)})`);

    // Build Airtable URL
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;
    console.log(`[airtable-read] 🌐 URL Airtable: ${airtableUrl}`);

    // Make request to Airtable
    const response = await fetch(airtableUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[airtable-read] ❌ Erreur Airtable ${response.status}: ${errorText}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'airtable_error',
          status: response.status,
          message: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[airtable-read] ✅ Succès lecture ${table}: ${data.records?.length || 0} records`);

    return new Response(
      JSON.stringify({
        success: true,
        records: data.records || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[airtable-read] ❌ Exception:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
