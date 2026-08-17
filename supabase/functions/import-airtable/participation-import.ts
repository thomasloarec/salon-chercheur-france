import type {
  AirtableParticipationRecord,
  ParticipationImportResult,
  AirtableConfig,
} from '../_shared/types.ts';
import {
  fetchAirtablePageRange,
  SUPABASE_BATCH_SIZE,
  MAX_AIRTABLE_PAGES_PER_CHUNK,
  CHUNK_TIME_BUDGET_MS,
  type ChunkOptions,
  type ChunkResult,
} from './chunk-utils.ts';

async function loadEventReferentials(supabaseClient: any) {
  const [{ data: publishedEvents }, { data: stagingEvents }] = await Promise.all([
    supabaseClient.from('events').select('id, id_event'),
    supabaseClient.from('staging_events_import').select(`
      id, id_event, nom_event, date_debut, date_fin, ville, secteur,
      url_image, url_site_officiel, description_event, nom_lieu,
      rue, code_postal, type_event, tarif, affluence
    `),
  ]);

  const eventIdToUuidMap = new Map<string, string>();
  publishedEvents?.forEach((e: any) => {
    if (e.id_event && e.id) eventIdToUuidMap.set(e.id_event, e.id);
  });

  const allEventIds = new Set<string>([
    ...(publishedEvents?.map((e: any) => e.id_event).filter(Boolean) ?? []),
    ...(stagingEvents?.map((e: any) => e.id_event).filter(Boolean) ?? []),
  ]);

  return { publishedEvents: publishedEvents ?? [], stagingEvents: stagingEvents ?? [], eventIdToUuidMap, allEventIds };
}

/**
 * ÉTAPE 3 historique : synchronisation staging -> events (visible: false).
 * `usedEventIds` : si fourni, restreint la synchronisation aux événements
 * référencés (chemin legacy). Si absent (mode tranches, premier appel),
 * tous les événements de staging absents de `events` sont synchronisés.
 */
async function syncStagingEvents(
  supabaseClient: any,
  stagingEvents: any[],
  publishedEvents: any[],
  eventIdToUuidMap: Map<string, string>,
  allEventIds: Set<string>,
  usedEventIds?: Set<string>,
): Promise<{ error?: string }> {
  const publishedEventIds = new Set(publishedEvents.map((e: any) => e.id_event).filter(Boolean));
  const eventsOnlyInStaging = stagingEvents.filter((se: any) =>
    se.id_event &&
    !publishedEventIds.has(se.id_event) &&
    (usedEventIds ? usedEventIds.has(se.id_event) : true)
  );

  if (eventsOnlyInStaging.length === 0) return {};

  console.log(`[SYNC] ${eventsOnlyInStaging.length} événements staging→events...`);

  const { error: syncError } = await supabaseClient
    .from('events')
    .upsert(
      eventsOnlyInStaging.map((e: any) => {
        const { id, ...eventData } = e;
        return { ...eventData, visible: false, updated_at: new Date().toISOString() };
      }),
      { onConflict: 'id_event' },
    );

  if (syncError) {
    console.error('[SYNC ERROR]', syncError);
    return { error: `Erreur sync: ${syncError.message}` };
  }

  const { data: newEvents } = await supabaseClient
    .from('events')
    .select('id, id_event')
    .in('id_event', eventsOnlyInStaging.map((e: any) => e.id_event));

  newEvents?.forEach((e: any) => {
    if (e.id_event && e.id) {
      eventIdToUuidMap.set(e.id_event, e.id);
      allEventIds.add(e.id_event);
    }
  });

  console.log(`[SYNC] ${eventsOnlyInStaging.length} événements synchronisés`);
  return {};
}

function firstValue(v: any): string | null {
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s || null;
}

/**
 * Extraction brute Airtable -> staging_participation_import.
 * Aucune validation ici : le loader SQL valide, rejette et charge.
 */
function toStagingRows(records: AirtableParticipationRecord[], sessionId: string): any[] {
  return records.map((r) => {
    const f = r.fields as any;
    return {
      import_session_id: sessionId,
      airtable_record_id: r.id,
      id_event_text: firstValue(f['id_event_text']),
      id_exposant: firstValue(f['id_exposant']),
      website_exposant: firstValue(f['website_exposant']),
      stand_exposant: firstValue(f['stand_exposant']),
      urlexpo_event: firstValue(f['urlexpo_event']),
      nom_exposant: firstValue(f['nom_exposant']),
    };
  });
}

/** INSERT simple par paquets (table staging sans contrainte unique). */
async function insertStagingRows(
  supabaseClient: any,
  rows: any[],
  batchSize = SUPABASE_BATCH_SIZE,
): Promise<{ inserted: number; errors: Array<{ record_id: string; reason: string }> }> {
  let inserted = 0;
  const errors: Array<{ record_id: string; reason: string }> = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabaseClient.from('staging_participation_import').insert(batch);
    if (error) {
      console.error('[STAGING] Erreur insertion batch:', error.message);
      errors.push({ record_id: 'STAGING_BATCH', reason: error.message });
    } else {
      inserted += batch.length;
    }
  }
  return { inserted, errors };
}

export interface ParticipationChunkOptions extends ChunkOptions {
  sessionId: string;
}

export interface ParticipationChunkResult extends ChunkResult {
  staged: number;
  stagedTotal?: number;
  upserted?: number;
  rejected?: number;
}

/** Traite UNE tranche bornée : extraction vers staging, puis chargement final via loader SQL. */
export async function importParticipationChunk(
  supabaseClient: any,
  airtableConfig: AirtableConfig,
  opts: ParticipationChunkOptions,
): Promise<ParticipationChunkResult> {
  const startedAt = opts.startedAt ?? Date.now();
  const sessionId = opts.sessionId;
  const errors: Array<{ record_id: string; reason: string }> = [];

  const { publishedEvents, stagingEvents, eventIdToUuidMap, allEventIds } = await loadEventReferentials(supabaseClient);

  // Première tranche : purge du staging de la session
  if (!opts.offset) {
    const { error: purgeErr } = await supabaseClient
      .from('staging_participation_import')
      .delete()
      .eq('import_session_id', sessionId);
    if (purgeErr) console.error('[STAGING] Purge initiale impossible:', purgeErr.message);
  }

  const { records, nextOffset, pagesFetched } = await fetchAirtablePageRange<AirtableParticipationRecord>(
    'Participation',
    airtableConfig,
    {
      offset: opts.offset,
      maxPages: opts.maxPages ?? MAX_AIRTABLE_PAGES_PER_CHUNK,
      timeBudgetMs: opts.timeBudgetMs ?? CHUNK_TIME_BUDGET_MS,
      startedAt,
    },
  );
  console.log(`[FETCH] Tranche participations: ${records.length} enregistrements sur ${pagesFetched} pages`);

  const usedEventIds = new Set<string>();
  for (const r of records) {
    const id = firstValue((r.fields as any)['id_event_text']);
    if (id) usedEventIds.add(id);
  }

  const { error: syncErr } = await syncStagingEvents(
    supabaseClient, stagingEvents, publishedEvents, eventIdToUuidMap, allEventIds, usedEventIds,
  );
  if (syncErr) {
    return { processed: 0, staged: 0, errors: [{ record_id: 'SYNC_ERROR', reason: syncErr }], done: true };
  }

  const { inserted, errors: stagingErrors } = await insertStagingRows(
    supabaseClient, toStagingRows(records, sessionId),
  );
  errors.push(...stagingErrors);

  if (nextOffset) {
    return { processed: 0, staged: inserted, errors, done: false, offset: nextOffset };
  }

  // ---------- Dernière tranche : chargement ensembliste ----------
  const { count: stagedTotal } = await supabaseClient
    .from('staging_participation_import')
    .select('id', { count: 'exact', head: true })
    .eq('import_session_id', sessionId);

  const { data: loadRes, error: loadErr } = await supabaseClient
    .rpc('load_participations_from_staging', { p_session_id: sessionId });

  if (loadErr) {
    console.error('[LOADER] Erreur:', loadErr.message);
    errors.push({ record_id: 'LOADER', reason: loadErr.message });
    return { processed: 0, staged: inserted, stagedTotal: stagedTotal ?? 0, upserted: 0, rejected: 0, errors, done: true };
  }

  const row = Array.isArray(loadRes) ? loadRes[0] : loadRes;
  const upserted = Number(row?.upserted) || 0;
  const rejected = Number(row?.rejected) || 0;
  console.log(`[LOADER] ${upserted} participations chargées, ${rejected} rejetées (staging: ${stagedTotal})`);

  const { error: cleanErr } = await supabaseClient
    .from('staging_participation_import')
    .delete()
    .eq('import_session_id', sessionId);
  if (cleanErr) console.error('[STAGING] Purge finale impossible:', cleanErr.message);

  return { processed: upserted, staged: inserted, stagedTotal: stagedTotal ?? 0, upserted, rejected, errors, done: true };
}

/** Chemin legacy monolithique : même pipeline staging + loader, en une passe. */
export async function importParticipation(
  supabaseClient: any,
  airtableConfig: AirtableConfig,
  sessionId: string,
): Promise<ParticipationImportResult & { stagedTotal: number; upserted: number; rejected: number }> {
  console.log('[PARTICIPATION] Début import (legacy, pipeline staging)...');

  const { publishedEvents, stagingEvents, eventIdToUuidMap, allEventIds } = await loadEventReferentials(supabaseClient);

  await supabaseClient.from('staging_participation_import').delete().eq('import_session_id', sessionId);

  const allParticipations: AirtableParticipationRecord[] = [];
  let offset: string | undefined = undefined;
  while (true) {
    const page: { records: AirtableParticipationRecord[]; nextOffset?: string; pagesFetched: number } =
      await fetchAirtablePageRange<AirtableParticipationRecord>('Participation', airtableConfig, {
        offset,
        maxPages: MAX_AIRTABLE_PAGES_PER_CHUNK,
        timeBudgetMs: Number.MAX_SAFE_INTEGER,
        startedAt: Date.now(),
      });
    allParticipations.push(...page.records);
    if (!page.nextOffset) break;
    offset = page.nextOffset;
  }
  console.log(`[FETCH] Total: ${allParticipations.length} participations depuis Airtable`);

  const usedEventIds = new Set<string>();
  for (const r of allParticipations) {
    const id = firstValue((r.fields as any)['id_event_text']);
    if (id) usedEventIds.add(id);
  }

  const { error: syncErr } = await syncStagingEvents(
    supabaseClient, stagingEvents, publishedEvents, eventIdToUuidMap, allEventIds, usedEventIds,
  );
  if (syncErr) {
    return {
      participationsImported: 0,
      participationErrors: [{ record_id: 'SYNC_ERROR', reason: syncErr }],
      stagedTotal: 0, upserted: 0, rejected: 0,
    };
  }

  const participationErrors: Array<{ record_id: string; reason: string }> = [];
  const { inserted, errors: stagingErrors } = await insertStagingRows(
    supabaseClient, toStagingRows(allParticipations, sessionId),
  );
  participationErrors.push(...stagingErrors);

  const { data: loadRes, error: loadErr } = await supabaseClient
    .rpc('load_participations_from_staging', { p_session_id: sessionId });

  if (loadErr) {
    participationErrors.push({ record_id: 'LOADER', reason: loadErr.message });
    return { participationsImported: 0, participationErrors, stagedTotal: inserted, upserted: 0, rejected: 0 };
  }

  const row = Array.isArray(loadRes) ? loadRes[0] : loadRes;
  const upserted = Number(row?.upserted) || 0;
  const rejected = Number(row?.rejected) || 0;

  await supabaseClient.from('staging_participation_import').delete().eq('import_session_id', sessionId);

  console.log(`[DONE] ${upserted} participations chargées, ${rejected} rejetées`);
  return { participationsImported: upserted, participationErrors, stagedTotal: inserted, upserted, rejected };
}
