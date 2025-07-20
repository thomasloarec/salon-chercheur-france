
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
    console.log('[airtable-debug] 🔍 Début inspection Airtable');
    
    const AIRTABLE_PAT = getEnvOrConfig('AIRTABLE_PAT');
    const AIRTABLE_BASE_ID = getEnvOrConfig('AIRTABLE_BASE_ID');
    
    if (!AIRTABLE_PAT) {
      return new Response(
        JSON.stringify({ 
          error: 'missing_pat',
          message: 'AIRTABLE_PAT non configuré'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const debug = {
      baseId: AIRTABLE_BASE_ID,
      pat: AIRTABLE_PAT ? `***${AIRTABLE_PAT.slice(-4)}` : 'NON',
      bases: null,
      tables: null,
      errors: []
    };

    try {
      // 1. Lister les bases accessibles
      console.log('[airtable-debug] 📋 Récupération des bases...');
      const basesResponse = await fetch('https://api.airtable.com/v0/meta/bases', {
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
      });

      if (basesResponse.ok) {
        const basesData = await basesResponse.json();
        debug.bases = basesData.bases?.map((base: any) => ({
          id: base.id,
          name: base.name,
          permissionLevel: base.permissionLevel
        })) || [];
        
        console.log('[airtable-debug] ✅ Bases récupérées:', debug.bases.length);
      } else {
        const errorText = await basesResponse.text();
        debug.errors.push(`Erreur récupération bases (${basesResponse.status}): ${errorText}`);
        console.error('[airtable-debug] ❌ Erreur bases:', basesResponse.status, errorText);
      }
    } catch (error) {
      debug.errors.push(`Exception lors de la récupération des bases: ${error.message}`);
      console.error('[airtable-debug] ❌ Exception bases:', error);
    }

    try {
      // 2. Lister les tables de la base configurée
      if (AIRTABLE_BASE_ID) {
        console.log('[airtable-debug] 📋 Récupération des tables pour', AIRTABLE_BASE_ID);
        const tablesResponse = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
            'Content-Type': 'application/json',
          },
        });

        if (tablesResponse.ok) {
          const tablesData = await tablesResponse.json();
          debug.tables = tablesData.tables?.map((table: any) => ({
            id: table.id,
            name: table.name,
            primaryFieldId: table.primaryFieldId
          })) || [];
          
          console.log('[airtable-debug] ✅ Tables récupérées:', debug.tables.length);
        } else {
          const errorText = await tablesResponse.text();
          debug.errors.push(`Erreur récupération tables (${tablesResponse.status}): ${errorText}`);
          console.error('[airtable-debug] ❌ Erreur tables:', tablesResponse.status, errorText);
        }
      }
    } catch (error) {
      debug.errors.push(`Exception lors de la récupération des tables: ${error.message}`);
      console.error('[airtable-debug] ❌ Exception tables:', error);
    }

    // 3. Vérification des tables requises
    const requiredTables = ['All_Events', 'All_Exposants', 'Participation'];
    if (debug.tables) {
      const foundTables = debug.tables.map((t: any) => t.name);
      const missingTables = requiredTables.filter(t => !foundTables.includes(t));
      
      if (missingTables.length > 0) {
        debug.errors.push(`Tables manquantes: ${missingTables.join(', ')}`);
      }
      
      debug.tablesCheck = {
        required: requiredTables,
        found: foundTables,
        missing: missingTables
      };
    }

    console.log('[airtable-debug] 📊 Debug complet:', debug);

    return new Response(
      JSON.stringify({
        success: true,
        debug
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[airtable-debug] ❌ Erreur générale:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'debug_failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
