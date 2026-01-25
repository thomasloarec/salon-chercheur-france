
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { importEvents } from './events-import.ts';
import { importExposants } from './exposants-import.ts';
import { importParticipation } from './participation-import.ts';
import type { AirtableConfig } from '../_shared/types.ts';

// Mode simplifié pour éviter CPU timeout
const DEBUG_ROOT_CAUSE = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

// Catégoriser une erreur en fonction de sa raison
function categorizeError(reason: string): string {
  if (reason.includes('nom_exposant manquant')) return 'missing_name';
  if (reason.includes('id_exposant manquant')) return 'missing_id';
  if (reason.includes('website manquant')) return 'missing_website';
  if (reason.includes('exposant non trouvé')) return 'exhibitor_not_found';
  if (reason.includes('event') && reason.includes('introuvable')) return 'event_not_found';
  if (reason.includes('Erreur sync')) return 'sync_error';
  if (reason.includes('Batch')) return 'batch_error';
  return 'other';
}

// Transformer les erreurs en format enrichi pour stockage
function enrichError(error: { record_id: string; reason: string }, entityType: string): {
  entity_type: string;
  airtable_record_id: string;
  error_category: string;
  error_reason: string;
  context_data: Record<string, any>;
} {
  const category = categorizeError(error.reason);
  
  // Extraire des données contextuelles depuis la raison
  const contextData: Record<string, any> = {};
  
  // Extraire le domaine du website si présent
  const websiteMatch = error.reason.match(/exposant non trouvé: (.+)/);
  if (websiteMatch) {
    contextData.website = websiteMatch[1];
  }
  
  // Extraire l'event si présent
  const eventMatch = error.reason.match(/event (.+) introuvable/);
  if (eventMatch) {
    contextData.event_id = eventMatch[1];
  }
  
  return {
    entity_type: entityType,
    airtable_record_id: error.record_id,
    error_category: category,
    error_reason: error.reason,
    context_data: contextData
  };
}

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

      // ÉTAPE 0: Créer une nouvelle session d'import
      console.log('[SESSION] Création session d\'import...');
      const { data: sessionData, error: sessionError } = await supabaseClient
        .from('import_sessions')
        .insert({ status: 'running' })
        .select('id')
        .single();
      
      if (sessionError || !sessionData) {
        console.error('[SESSION] Erreur création session:', sessionError);
        throw new Error('Impossible de créer une session d\'import');
      }
      
      const sessionId = sessionData.id;
      console.log('[SESSION] Session créée:', sessionId);

      // ÉTAPE 0.5: Supprimer les anciennes erreurs non résolues
      // On garde les erreurs résolues comme historique mais on nettoie les erreurs non résolues
      console.log('[CLEANUP] Suppression des anciennes erreurs non résolues...');
      const { error: cleanupError } = await supabaseClient
        .from('import_errors')
        .delete()
        .eq('resolved', false);
      
      if (cleanupError) {
        console.warn('[CLEANUP] Avertissement suppression erreurs:', cleanupError.message);
      }

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

      // ÉTAPE 4: Stocker les erreurs en base
      console.log('[ERRORS] Stockage des erreurs en base...');
      
      const allErrors = [
        ...eventErrors.map(e => enrichError(e, 'event')),
        ...exposantErrors.map(e => enrichError(e, 'exposant')),
        ...participationErrors.map(e => enrichError(e, 'participation'))
      ];
      
      if (allErrors.length > 0) {
        // Insérer par lots de 500
        const batchSize = 500;
        for (let i = 0; i < allErrors.length; i += batchSize) {
          const batch = allErrors.slice(i, i + batchSize).map(e => ({
            ...e,
            import_session_id: sessionId
          }));
          
          const { error: insertError } = await supabaseClient
            .from('import_errors')
            .insert(batch);
          
          if (insertError) {
            console.error('[ERRORS] Erreur insertion batch:', insertError.message);
          }
        }
        
        console.log(`[ERRORS] ${allErrors.length} erreurs stockées`);
      }

      // ÉTAPE 5: Mettre à jour la session avec le résumé
      const { error: updateError } = await supabaseClient
        .from('import_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          events_imported: eventsImported,
          exposants_imported: exposantsImported,
          participations_imported: participationsImported,
          events_errors: eventErrors.length,
          exposants_errors: exposantErrors.length,
          participations_errors: participationErrors.length
        })
        .eq('id', sessionId);
      
      if (updateError) {
        console.error('[SESSION] Erreur mise à jour session:', updateError.message);
      }

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
      }

      // Summary response
      const summary = {
        success: true,
        sessionId,
        eventsImported,
        exposantsImported,
        participationsImported,
        errors: {
          events: eventErrors,
          exposants: exposantErrors,
          participation: participationErrors
        },
        errorsPersisted: allErrors.length,
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
