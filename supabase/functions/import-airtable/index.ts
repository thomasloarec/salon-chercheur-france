
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { importEvents } from './events-import.ts';
import { importExposants } from './exposants-import.ts';
import { importParticipation } from './participation-import.ts';
import type { AirtableConfig } from '../_shared/types.ts';

// 🚧 MODE DEBUG ROOT-CAUSE 🚧
const DEBUG_ROOT_CAUSE = true;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  if (req.method === 'POST') {
    try {
      console.log('Starting Airtable import...');
      
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
      const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

      if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
        console.error('Missing Airtable credentials');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'missing_credentials' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Debug configuration variables
      console.log('[DEBUG] Config Airtable – Table Events: All_Events');
      console.log('[DEBUG] Config Airtable – Table Exposants: All_Exposants');
      console.log('[DEBUG] Config Airtable – Base ID:', AIRTABLE_BASE_ID);
      console.log('[DEBUG] Config Airtable – PAT présent:', !!AIRTABLE_PAT);

      const airtableConfig = {
        pat: AIRTABLE_PAT,
        baseId: AIRTABLE_BASE_ID
      };

      // 1. Import des événements
      console.log('[DEBUG] Début import événements...');
      const { eventsImported, eventErrors } = await importEvents(supabaseClient, airtableConfig);
      console.log('[DEBUG] eventsImported =', eventsImported);

      // 2. Import des exposants (toujours exécuté)
      console.log('[DEBUG] Début import exposants...');
      const { exposantsImported, exposantErrors } = await importExposants(supabaseClient, airtableConfig);
      console.log('[DEBUG] exposantsImported =', exposantsImported);

      // 3. Import des participations (toujours exécuté)
      console.log('[DEBUG] Début import participations...');
      const { participationsImported, participationErrors } = await importParticipation(supabaseClient, airtableConfig);
      console.log('[DEBUG] participationsImported =', participationsImported);
      console.log('[DEBUG] participationErrors =', participationErrors.length);

      // DEBUG ROOT-CAUSE: Génération du rapport JSON
      if (DEBUG_ROOT_CAUSE) {
        const debugReport = {
          timestamp: new Date().toISOString(),
          events: { 
            fetched: 'Not available in current context', 
            toInsert: eventsImported, 
            mismatchFields: 'See console logs for field comparison' 
          },
          exposants: { 
            fetched: 'Not available in current context', 
            toInsert: exposantsImported, 
            mismatchFields: 'See console logs for field comparison' 
          },
          participation: { 
            fetched: 'Not available in current context', 
            toInsert: participationsImported, 
            mismatchFields: 'See console logs for field comparison' 
          },
          rootCauseAnalysis: {
            hasZeroExposants: exposantsImported === 0,
            hasZeroParticipations: participationsImported === 0,
            suggestions: [
              'Vérifier les noms de tables Airtable',
              'Vérifier les noms de champs',
              'Tester un import sur un seul enregistrement',
              'Comparer le mapping via API REST Airtable (cURL/Postman)',
              'Vérifier les permissions PAT sur la base'
            ]
          }
        };

        console.log('[DEBUG_ROOT] RAPPORT FINAL:', JSON.stringify(debugReport, null, 2));
        
        // Note: Dans Deno edge functions, on ne peut pas écrire dans /tmp
        // Le rapport est disponible dans les logs de la fonction
      }

      // Summary response
      const summary = {
        success: true,
        eventsImported,
        exposantsImported,
        participationsImported,
        errors: {
          events: eventErrors,
          exposants: exposantErrors,
          participation: participationErrors
        },
        message: `Import completed: ${eventsImported} events, ${exposantsImported} exposants, ${participationsImported} participations imported`,
        ...(DEBUG_ROOT_CAUSE && { debugMode: true, checkLogs: 'See function logs for detailed root cause analysis' })
      };

      console.log('Import completed:', summary);

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error in import-airtable function:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
