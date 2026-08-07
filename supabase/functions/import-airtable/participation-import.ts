import type {
  AirtableParticipationRecord,
  ParticipationImportResult,
  AirtableConfig,
} from '../_shared/types.ts';
import {
  fetchAirtablePageRange,
  batchUpsertCounted,
  SUPABASE_BATCH_SIZE,
  MAX_AIRTABLE_PAGES_PER_CHUNK,
  CHUNK_TIME_BUDGET_MS,
  type ChunkOptions,
  type ChunkResult,
} from './chunk-utils.ts';

function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0].split('#')[0].split('?')[0];
  s = s.replace(/\.$/, '').replace(/:\d+$/, '');
  return s || null;
}

interface Referentials {
  eventIdToUuidMap: Map<string, string>;
  allEventIds: Set<string>;
  websiteToExposantMap: Map<string, string>;
  lockedStands: Map<string, string | null>;
}

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

async function loadExposantMap(supabaseClient: any): Promise<Map<string, string>> {
  const websiteToExposantMap = new Map<string, string>();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data: page, error } = await supabaseClient
      .from('exposants')
      .select('id_exposant, website_exposant')
      .range(offset, offset + pageSize - 1);

    if (error || !page || page.length === 0) break;
    page.forEach((e: any) => {
      if (e.website_exposant && e.id_exposant) {
        const normalized = normalizeDomain(e.website_exposant);
        if (normalized) websiteToExposantMap.set(normalized, e.id_exposant);
      }
    });
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`[MAPPING] ${websiteToExposantMap.size} websites mappés`);
  return websiteToExposantMap;
}

async function loadLockedStands(supabaseClient: any): Promise<Map<string, string | null>> {
  // Clé STABLE indépendante du stand : (id_exposant, id_event_text)
  const lockedStands = new Map<string, string | null>();
  let lockedOffset = 0;
  const lockedPageSize = 1000;

  while (true) {
    const { data: lockedPage, error: lockedError } = await supabaseClient
      .from('participation')
      .select('id_exposant, id_event_text, stand_exposant')
      .eq('stand_locked', true)
      .range(lockedOffset, lockedOffset + lockedPageSize - 1);

    if (lockedError) {
      console.error('[STAND_LOCK] Lecture impossible:', lockedError.message);
      break;
    }
    if (!lockedPage || lockedPage.length === 0) break;
    lockedPage.forEach((p: any) => {
      if (p.id_exposant && p.id_event_text) {
        lockedStands.set(`${p.id_exposant}__${p.id_event_text}`, p.stand_exposant ?? null);
      }
    });
    if (lockedPage.length < lockedPageSize) break;
    lockedOffset += lockedPageSize;
  }

  return lockedStands;
}

/** Prépare, dédoublonne et upserte un ensemble d'enregistrements Airtable Participation. */
function prepareRows(
  records: AirtableParticipationRecord[],
  ref: Referentials,
): { rows: any[]; errors: Array<{ record_id: string; reason: string }> } {
  const toInsert: any[] = [];
  const participationErrors: Array<{ record_id: string; reason: string }> = [];

  for (const r of records) {
    const f = r.fields as any;
    const recordId = r.id;

    const rawEventField = f['id_event_text'];
    const eventIdText = Array.isArray(rawEventField) ? rawEventField[0]?.trim() : rawEventField?.trim();

    if (!eventIdText || !ref.allEventIds.has(eventIdText)) {
      participationErrors.push({ record_id: recordId, reason: `event ${eventIdText || 'vide'} introuvable` });
      continue;
    }

    const rawWebsite = f['website_exposant'];
    const websiteExposant = Array.isArray(rawWebsite) ? rawWebsite[0]?.trim() : rawWebsite?.trim();
    const normalizedWebsite = normalizeDomain(websiteExposant);

    if (!normalizedWebsite) {
      participationErrors.push({ record_id: recordId, reason: 'website manquant' });
      continue;
    }

    const exposantId = ref.websiteToExposantMap.get(normalizedWebsite);
    if (!exposantId) {
      participationErrors.push({ record_id: recordId, reason: `exposant non trouvé: ${normalizedWebsite}` });
      continue;
    }

    const standInfo = f['stand_exposant']?.trim() || '';
    const urlExpoKey = `${eventIdText}_${normalizedWebsite}_${standInfo}`;
    const eventUuid = ref.eventIdToUuidMap.get(eventIdText);

    toInsert.push({
      urlexpo_event: urlExpoKey,
      id_event_text: eventIdText,
      id_event: eventUuid || null,
      id_exposant: exposantId,
      stand_exposant: standInfo || null,
      website_exposant: websiteExposant,
      last_seen_at: new Date().toISOString(),
    });
  }

  // Dédoublonnage intra-tranche par clé métier stable (exposant, événement)
  const uniqueMap = new Map<string, any>();
  for (const item of toInsert) uniqueMap.set(`${item.id_exposant}__${item.id_event_text}`, item);
  const rows = Array.from(uniqueMap.values());

  // PROTECTION STAND : ne jamais écraser un stand verrouillé par l'exposant
  let preservedStands = 0;
  if (ref.lockedStands.size > 0) {
    for (const item of rows) {
      const lockKey = `${item.id_exposant}__${item.id_event_text}`;
      if (ref.lockedStands.has(lockKey)) {
        item.stand_exposant = ref.lockedStands.get(lockKey) ?? null;
        preservedStands++;
      }
    }
  }
  console.log(`[PREP] ${rows.length} participations à insérer (${toInsert.length - rows.length} doublons, ${participationErrors.length} erreurs, ${preservedStands} stands préservés)`);

  return { rows, errors: participationErrors };
}

export type ParticipationChunkOptions = ChunkOptions;

/** Traite UNE tranche bornée de participations (80 pages max, budget 60 s). */
export async function importParticipationChunk(
  supabaseClient: any,
  airtableConfig: AirtableConfig,
  opts: ParticipationChunkOptions = {},
): Promise<ChunkResult> {
  const startedAt = opts.startedAt ?? Date.now();
  const errors: Array<{ record_id: string; reason: string }> = [];

  const { publishedEvents, stagingEvents, eventIdToUuidMap, allEventIds } = await loadEventReferentials(supabaseClient);

  const [websiteToExposantMap, lockedStands] = await Promise.all([
    loadExposantMap(supabaseClient),
    loadLockedStands(supabaseClient),
  ]);

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

  // Sync staging -> events restreinte aux événements référencés par CETTE tranche
  const usedEventIds = new Set<string>();
  for (const r of records) {
    const raw = (r.fields as any)['id_event_text'];
    const rawEventId = Array.isArray(raw) ? raw[0]?.trim() : raw?.trim();
    if (rawEventId) usedEventIds.add(rawEventId);
  }

  const { error: syncErr } = await syncStagingEvents(
    supabaseClient, stagingEvents, publishedEvents, eventIdToUuidMap, allEventIds, usedEventIds,
  );
  if (syncErr) {
    return { processed: 0, errors: [{ record_id: 'SYNC_ERROR', reason: syncErr }], done: true };
  }

  const ref: Referentials = { eventIdToUuidMap, allEventIds, websiteToExposantMap, lockedStands };
  const { rows, errors: prepErrors } = prepareRows(records, ref);
  errors.push(...prepErrors);

  let processed = 0;
  if (rows.length > 0) {
    const { inserted, errors: batchErrors } = await batchUpsertCounted(
      supabaseClient, 'participation', rows, 'id_exposant,id_event_text', SUPABASE_BATCH_SIZE,
    );
    processed = inserted;
    batchErrors.forEach(err => errors.push({ record_id: 'BATCH', reason: err }));
  }

  return { processed, errors, done: !nextOffset, offset: nextOffset };
}

/**
 * Chemin legacy : comportement monolithique historique.
 * Fetch complet, sync staging restreinte aux événements réellement référencés,
 * puis préparation / dédoublonnage / upsert global.
 */
export async function importParticipation(
  supabaseClient: any,
  airtableConfig: AirtableConfig,
): Promise<ParticipationImportResult> {
  console.log('[PARTICIPATION] Début import (legacy)...');

  const { publishedEvents, stagingEvents, eventIdToUuidMap, allEventIds } = await loadEventReferentials(supabaseClient);
  console.log(`[EVENTS] ${allEventIds.size} événements disponibles`);

  // Fetch complet (boucle de tranches sans budget temps)
  const allParticipations: AirtableParticipationRecord[] = [];
  let offset: string | undefined = undefined;
  while (true) {
    const page: { records: AirtableParticipationRecord[]; nextOffset?: string; pagesFetched: number } = await fetchAirtablePageRange<AirtableParticipationRecord>("Participation", airtableConfig, {
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
    const raw = (r.fields as any)['id_event_text'];
    const rawEventId = Array.isArray(raw) ? raw[0]?.trim() : raw?.trim();
    if (rawEventId) usedEventIds.add(rawEventId);
  }
  console.log(`[EVENTS] ${usedEventIds.size} événements référencés par participations`);

  const { error: syncErr } = await syncStagingEvents(
    supabaseClient, stagingEvents, publishedEvents, eventIdToUuidMap, allEventIds, usedEventIds,
  );
  if (syncErr) {
    return { participationsImported: 0, participationErrors: [{ record_id: 'SYNC_ERROR', reason: syncErr }] };
  }

  const [websiteToExposantMap, lockedStands] = await Promise.all([
    loadExposantMap(supabaseClient),
    loadLockedStands(supabaseClient),
  ]);

  const ref: Referentials = { eventIdToUuidMap, allEventIds, websiteToExposantMap, lockedStands };
  const { rows, errors: participationErrors } = prepareRows(allParticipations, ref);

  let participationsImported = 0;
  if (rows.length > 0) {
    const { inserted, errors } = await batchUpsertCounted(
      supabaseClient, 'participation', rows, 'id_exposant,id_event_text', SUPABASE_BATCH_SIZE,
    );
    participationsImported = inserted;
    errors.forEach(err => participationErrors.push({ record_id: 'BATCH', reason: err }));
  }

  console.log(`[DONE] ${participationsImported} participations importées`);
  return { participationsImported, participationErrors };
}
