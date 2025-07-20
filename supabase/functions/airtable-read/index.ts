
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_TABLES = ['All_Events', 'All_Exposants', 'Participation'];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[airtable-read] 🔍 Début de la requête de lecture');

    // -------- 1. EXTRACTION TABLE (dual mode GET/POST) --------
    const url = new URL(req.url);
    console.log('[airtable-read] url=', url.href);
    
    let table: string | null = null;
    
    if (req.method === 'GET') {
      table = url.searchParams.get('table');
      console.log('[airtable-read] Mode GET, table param =', table);
    } else {
      try {
        const body = await req.json();
        table = body?.table;
        console.log('[airtable-read] Mode POST, table from body =', table);
      } catch (jsonError) {
        console.log('[airtable-read] No JSON body, checking URL params as fallback');
        table = url.searchParams.get('table');
      }
    }

    console.log('[airtable-read] tableParam final =', table);

    if (!table) {
      console.error('[airtable-read] ❌ Table parameter missing');
      return new Response(
        JSON.stringify({ success: false, message: "Missing 'table' query/body param" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tolérance casse + espaces
    table = table.trim();
    const matched = ALLOWED_TABLES.find(t => t.toLowerCase() === table.toLowerCase());
    if (!matched) {
      console.error(`[airtable-read] ❌ Table '${table}' not allowed`);
      return new Response(
        JSON.stringify({ success: false, message: `Table '${table}' not allowed` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    table = matched;

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
