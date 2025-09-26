
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'

const ALLOWED_TABLES = ['All_Events', 'All_Exposants', 'Participation'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req);

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
      return json({ success: false, message: "Missing 'table' query/body param" }, 400, req);
    }

    // Tolérance casse + espaces
    table = table.trim();
    const matched = ALLOWED_TABLES.find(t => t.toLowerCase() === table?.toLowerCase());
    if (!matched) {
      console.error(`[airtable-read] ❌ Table '${table}' not allowed`);
      return json({ success: false, message: `Table '${table}' not allowed` }, 400, req);
    }
    table = matched;

    // Get environment variables
    const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      console.error('[airtable-read] ❌ Variables manquantes');
      return json({
        success: false,
        error: 'missing_env',
        missing: ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID']
      }, 500, req);
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
      
      return json({
        success: false,
        error: 'airtable_error',
        status: response.status,
        message: errorText
      }, response.status);
    }

    const data = await response.json();
    console.log(`[airtable-read] ✅ Succès lecture ${table}: ${data.records?.length || 0} records`);

    return json({
      success: true,
      records: data.records || []
    }, 200);

  } catch (error) {
    console.error('[airtable-read] ❌ Exception:', error);
    return json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

function json(body: unknown, status = 200, request?: Request) {
  const headers = request ? corsHeaders(request) : { 'Access-Control-Allow-Origin': '*' };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
