import { getEnvOrConfig } from '../_shared/airtable-config.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
// Correctif sécurité 07/10/2026 : réservée aux admins ; n'énumère plus les bases du compte Airtable
// et ne renvoie plus aucun fragment du jeton.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireAdmin(req, corsHeaders, 'airtable-debug');
  if (denied) return denied;

  try {
    const AIRTABLE_PAT = getEnvOrConfig('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = getEnvOrConfig('AIRTABLE_BASE_ID');
    if (!AIRTABLE_PAT) {
      return new Response(JSON.stringify({ error: 'missing_pat', message: 'AIRTABLE_PAT non configuré' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const debug = {
      baseId: AIRTABLE_BASE_ID,
      pat: AIRTABLE_PAT ? 'configuré' : 'NON',
      bases: [] as any[],
      tables: null as any[] | null,
      errors: [] as string[],
      tablesCheck: null as any
    };

    try {
      if (AIRTABLE_BASE_ID) {
        const tablesResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
          headers: { Authorization: `Bearer ${AIRTABLE_PAT}`, 'Content-Type': 'application/json' },
        });
        if (tablesResponse.ok) {
          const tablesData = await tablesResponse.json();
          debug.tables = tablesData.tables?.map((table: any) => ({ id: table.id, name: table.name, primaryFieldId: table.primaryFieldId })) || [];
        } else {
          const errorText = await tablesResponse.text();
          debug.errors.push(`Erreur récupération tables (${tablesResponse.status}): ${errorText}`);
        }
      }
    } catch (error) {
      debug.errors.push(`Exception lors de la récupération des tables: ${error instanceof Error ? error.message : String(error)}`);
    }

    const requiredTables = ['All_Events', 'All_Exposants', 'Participation'];
    if (debug.tables) {
      const foundTables = debug.tables.map((t: any) => t.name);
      const missingTables = requiredTables.filter(t => !foundTables.includes(t));
      if (missingTables.length > 0) debug.errors.push(`Tables manquantes: ${missingTables.join(', ')}`);
      debug.tablesCheck = { required: requiredTables, found: foundTables, missing: missingTables };
    }

    return new Response(JSON.stringify({ success: true, debug }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'debug_failed', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
