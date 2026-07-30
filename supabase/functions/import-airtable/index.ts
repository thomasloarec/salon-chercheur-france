import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importEvents } from './events-import.ts';
import { importExposants, importExposantsChunk } from './exposants-import.ts';
import { importParticipation, importParticipationChunk } from './participation-import.ts';
import {
  AirtableOffsetExpiredError,
  MAX_AIRTABLE_PAGES_PER_CHUNK,
  CHUNK_TIME_BUDGET_MS,
} from './chunk-utils.ts';
import type { AirtableConfig } from '../_shared/types.ts';

// Mode simplifié pour éviter CPU timeout
const DEBUG_ROOT_CAUSE: boolean = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

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
function enrichError(error: { record_id: string; reason: string }, entityType: string) {
  const category = categorizeError(error.reason);
  const contextData: Record<string, any> = {};

  const websiteMatch = error.reason.match(/exposant non trouvé: (.+)/);
  if (websiteMatch) contextData.website = websiteMatch[1];

  const eventMatch = error.reason.match(/event (.+) introuvable/);
  if (eventMatch) contextData.event_id = eventMatch[1];

  return {
    entity_type: entityType,
    airtable_record_id: error.record_id,
    error_category: category,
    error_reason: error.reason,
    context_data: contextData,
  };
}

async function persistErrors(
  supabaseClient: any,
  errors: Array<{ record_id: string; reason: string }>,
  entityType: string,
  sessionId: string,
) {
  if (errors.length === 0) return;
  const enriched = errors.map(e => enrichError(e, entityType));
  const batchSize = 500;
  for (let i = 0; i < enriched.length; i += batchSize) {
    const batch = enriched.slice(i, i + batchSize).map(e => ({ ...e, import_session_id: sessionId }));
    const { error: insertError } = await supabaseClient.from('import_errors').insert(batch);
    if (insertError) console.error('[ERRORS] Erreur insertion batch:', insertError.message);
  }
}

function fireAndForget() {
  // Fire-and-forget : enrichissement IA des nouveaux exposants
  try {
    const enrichUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-exposants-ai`;
    fetch(enrichUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggered_by: 'import-airtable' }),
    }).catch(() => {});
  } catch (_) { /* silence total */ }

  // Fire-and-forget : génération des accroches IA pour les nouveaux salons
  try {
    const accrochesUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-event-accroches`;
    fetch(accrochesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggered_by: 'import-airtable' }),
    }).catch(() => {});
  } catch (_) { /* silence total */ }
}

/** Incrémente un compteur de session (orchestration strictement séquentielle). */
async function bumpSessionCounters(
  supabaseClient: any,
  sessionId: string,
  fields: Record<string, number>,
) {
  const keys = Object.keys(fields);
  const { data: current } = await supabaseClient
    .from('import_sessions')
    .select(keys.join(','))
    .eq('id', sessionId)
    .single();

  const patch: Record<string, number> = {};
  for (const k of keys) patch[k] = (current?.[k] ?? 0) + fields[k];

  const { error } = await supabaseClient.from('import_sessions').update(patch).eq('id', sessionId);
  if (error) console.error('[SESSION] Erreur incrément compteurs:', error.message);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
  const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    console.error('Missing Airtable credentials');
    return json({ success: false, error: 'missing_credentials' }, 500);
  }

  const airtableConfig: AirtableConfig = { pat: AIRTABLE_PAT, baseId: AIRTABLE_BASE_ID };

  // Body : tolérant (vide ou non JSON => chemin legacy)
  let body: any = {};
  try {
    body = await req.json();
    if (!body || typeof body !== 'object') body = {};
  } catch (_) {
    body = {};
  }

  const action = typeof body.action === 'string' ? body.action : undefined;
  const step = typeof body.step === 'string' ? body.step : undefined;

  // ==========================================================
  // MACHINE À ÉTATS (Lot A)
  // ==========================================================
  if (action === 'start' || step) {
    const startedAt = Date.now();
    try {
      // ---------- 1. START ----------
      if (action === 'start') {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { error: orphanError } = await supabaseClient
          .from('import_sessions')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('status', 'running')
          .lt('started_at', tenMinutesAgo);
        if (orphanError) console.warn('[SESSION] Nettoyage sessions orphelines:', orphanError.message);

        const { error: cleanupError } = await supabaseClient
          .from('import_errors')
          .delete()
          .eq('resolved', false);
        if (cleanupError) console.warn('[CLEANUP] Avertissement suppression erreurs:', cleanupError.message);

        const { data: sessionData, error: sessionError } = await supabaseClient
          .from('import_sessions')
          .insert({ status: 'running' })
          .select('id')
          .single();

        if (sessionError || !sessionData) {
          console.error('[SESSION] Erreur création session:', sessionError);
          return json({ success: false, error: 'session_creation_failed' }, 500);
        }

        return json({ success: true, session_id: sessionData.id, next_step: 'events' });
      }

      const sessionId = typeof body.session_id === 'string' ? body.session_id : undefined;
      if (!sessionId) {
        return json({ success: false, error: 'session_id_required' }, 400);
      }
      const offset: string | undefined = typeof body.offset === 'string' && body.offset ? body.offset : undefined;

      // ---------- 2. EVENTS ----------
      if (step === 'events') {
        const { eventsImported, eventErrors } = await importEvents(supabaseClient, airtableConfig);
        await persistErrors(supabaseClient, eventErrors, 'event', sessionId);

        const { error: updErr } = await supabaseClient
          .from('import_sessions')
          .update({ events_imported: eventsImported, events_errors: eventErrors.length })
          .eq('id', sessionId);
        if (updErr) console.error('[SESSION] Erreur MAJ events:', updErr.message);

        return json({
          success: true,
          done: true,
          next_step: 'exposants',
          imported: eventsImported,
          errors_count: eventErrors.length,
        });
      }

      // ---------- 3. EXPOSANTS ----------
      if (step === 'exposants') {
        const chunk = await importExposantsChunk(supabaseClient, airtableConfig, {
          offset,
          maxPages: MAX_AIRTABLE_PAGES_PER_CHUNK,
          timeBudgetMs: CHUNK_TIME_BUDGET_MS,
          startedAt,
        });

        await persistErrors(supabaseClient, chunk.errors, 'exposant', sessionId);
        await bumpSessionCounters(supabaseClient, sessionId, {
          exposants_imported: chunk.processed,
          exposants_errors: chunk.errors.length,
        });

        if (!chunk.done) {
          return json({ success: true, done: false, offset: chunk.offset, processed: chunk.processed });
        }
        return json({ success: true, done: true, next_step: 'participations', processed: chunk.processed });
      }

      // ---------- 4. PARTICIPATIONS ----------
      if (step === 'participations') {
        const chunk = await importParticipationChunk(supabaseClient, airtableConfig, {
          offset,
          maxPages: MAX_AIRTABLE_PAGES_PER_CHUNK,
          timeBudgetMs: CHUNK_TIME_BUDGET_MS,
          startedAt,
        });

        await persistErrors(supabaseClient, chunk.errors, 'participation', sessionId);
        await bumpSessionCounters(supabaseClient, sessionId, {
          participations_imported: chunk.processed,
          participations_errors: chunk.errors.length,
        });

        if (!chunk.done) {
          return json({ success: true, done: false, offset: chunk.offset, processed: chunk.processed });
        }

        const { error: finErr } = await supabaseClient
          .from('import_sessions')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', sessionId);
        if (finErr) console.error('[SESSION] Erreur finalisation:', finErr.message);

        fireAndForget();

        return json({ success: true, done: true, completed: true, session_id: sessionId, processed: chunk.processed });
      }

      return json({ success: false, error: 'unknown_step' }, 400);
    } catch (error) {
      if (error instanceof AirtableOffsetExpiredError) {
        console.error('[AIRTABLE] Offset expiré:', error.message);
        return json({ success: false, error: 'airtable_offset_expired', restart_step: true }, 409);
      }
      console.error('Error in import-airtable (stepped):', error);
      return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }

  // ==========================================================
  // CHEMIN LEGACY (POST sans step ni action) — inchangé
  // ==========================================================
  try {
    console.log('Starting Airtable import...');

    console.log('[DEBUG] Config Airtable – Table Events: All_Events');
    console.log('[DEBUG] Config Airtable – Table Exposants: All_Exposants');
    console.log('[DEBUG] Config Airtable – Base ID:', AIRTABLE_BASE_ID);
    console.log('[DEBUG] Config Airtable – PAT présent:', !!AIRTABLE_PAT);

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

    // 2. Import des exposants
    console.log('[DEBUG] Début import exposants...');
    const { exposantsImported, exposantErrors } = await importExposants(supabaseClient, airtableConfig);
    console.log('[DEBUG] exposantsImported =', exposantsImported);

    // 3. Import des participations
    console.log('[DEBUG] Début import participations...');
    const { participationsImported, participationErrors } = await importParticipation(supabaseClient, airtableConfig);
    console.log('[DEBUG] participationsImported =', participationsImported);
    console.log('[DEBUG] participationErrors =', participationErrors.length);

    // ÉTAPE 4: Stocker les erreurs en base
    console.log('[ERRORS] Stockage des erreurs en base...');
    const allErrors = [
      ...eventErrors.map(e => enrichError(e, 'event')),
      ...exposantErrors.map(e => enrichError(e, 'exposant')),
      ...participationErrors.map(e => enrichError(e, 'participation')),
    ];

    if (allErrors.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < allErrors.length; i += batchSize) {
        const batch = allErrors.slice(i, i + batchSize).map(e => ({ ...e, import_session_id: sessionId }));
        const { error: insertError } = await supabaseClient.from('import_errors').insert(batch);
        if (insertError) console.error('[ERRORS] Erreur insertion batch:', insertError.message);
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
        participations_errors: participationErrors.length,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[SESSION] Erreur mise à jour session:', updateError.message);
    }

    const summary = {
      success: true,
      sessionId,
      eventsImported,
      exposantsImported,
      participationsImported,
      errors: {
        events: eventErrors,
        exposants: exposantErrors,
        participation: participationErrors,
      },
      errorsPersisted: allErrors.length,
      message: `Import completed: ${eventsImported} events, ${exposantsImported} exposants, ${participationsImported} participations imported`,
      ...(DEBUG_ROOT_CAUSE ? { debugMode: true, checkLogs: 'See function logs for detailed root cause analysis' } : {}),
    };

    console.log('Import completed:', summary);

    fireAndForget();

    return json(summary);
  } catch (error) {
    console.error('Error in import-airtable function:', error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
