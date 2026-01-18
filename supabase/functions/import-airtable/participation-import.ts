import type { 
  AirtableParticipationRecord, 
  ParticipationImportResult, 
  AirtableConfig,
  AirtableResponse 
} from '../_shared/types.ts';

// Configuration des batches pour éviter le CPU timeout
const AIRTABLE_PAGE_SIZE = 100; // Taille des pages Airtable
const SUPABASE_BATCH_SIZE = 500; // Taille des batches pour upsert Supabase

async function fetchAllParticipations(airtableConfig: AirtableConfig): Promise<AirtableParticipationRecord[]> {
  const allRecords: AirtableParticipationRecord[] = [];
  let offset: string | undefined;
  let pageCount = 0;
  
  do {
    const url = new URL(`https://api.airtable.com/v0/${airtableConfig.baseId}/Participation`);
    if (offset) {
      url.searchParams.set('offset', offset);
    }
    
    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${airtableConfig.pat}` }
    });
    
    if (!response.ok) {
      throw new Error(`Fetch participation failed: ${response.status}`);
    }
    
    const data: AirtableResponse<AirtableParticipationRecord> = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;
    pageCount++;
    
    // Log moins fréquent pour économiser du CPU
    if (pageCount % 10 === 0) {
      console.log(`[FETCH] ${allRecords.length} participations chargées...`);
    }
  } while (offset);
  
  console.log(`[FETCH] Total: ${allRecords.length} participations depuis Airtable`);
  return allRecords;
}

// Fonction utilitaire pour insérer par lots
async function batchUpsert(
  supabaseClient: any, 
  tableName: string,
  records: any[], 
  conflictColumn: string,
  batchSize: number
): Promise<{ inserted: number; errors: string[] }> {
  let totalInserted = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(records.length / batchSize);
    
    try {
      const { data, error } = await supabaseClient
        .from(tableName)
        .upsert(batch, { onConflict: conflictColumn })
        .select();
      
      if (error) {
        console.error(`[BATCH ${batchNum}/${totalBatches}] Erreur:`, error.message);
        errors.push(`Batch ${batchNum}: ${error.message}`);
      } else {
        totalInserted += data?.length || 0;
        // Log seulement tous les 5 batches
        if (batchNum % 5 === 0 || batchNum === totalBatches) {
          console.log(`[BATCH ${batchNum}/${totalBatches}] ${totalInserted} insérés`);
        }
      }
    } catch (e) {
      errors.push(`Batch ${batchNum}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  return { inserted: totalInserted, errors };
}

export async function importParticipation(supabaseClient: any, airtableConfig: AirtableConfig): Promise<ParticipationImportResult> {
  console.log('[PARTICIPATION] Début import...');
  
  // ÉTAPE 1: Charger événements (publiés + staging)
  const [{ data: publishedEvents }, { data: stagingEvents }] = await Promise.all([
    supabaseClient.from('events').select('id, id_event'),
    supabaseClient.from('staging_events_import').select(`
      id, id_event, nom_event, date_debut, date_fin, ville, secteur,
      url_image, url_site_officiel, description_event, nom_lieu, 
      rue, code_postal, type_event, tarif, affluence
    `)
  ]);
  
  // Mapping id_event_text -> UUID
  const eventIdToUuidMap = new Map<string, string>();
  publishedEvents?.forEach((e: any) => {
    if (e.id_event && e.id) {
      eventIdToUuidMap.set(e.id_event, e.id);
    }
  });
  
  const allEventIds = new Set<string>([
    ...(publishedEvents?.map((e: any) => e.id_event).filter(Boolean) ?? []),
    ...(stagingEvents?.map((e: any) => e.id_event).filter(Boolean) ?? [])
  ]);
  console.log(`[EVENTS] ${allEventIds.size} événements disponibles`);
  
  // ÉTAPE 2: Charger participations Airtable
  const allParticipations = await fetchAllParticipations(airtableConfig);

  // Extraire les id_event utilisés
  const usedEventIds = new Set<string>();
  for (const r of allParticipations) {
    const rawEventId = Array.isArray(r.fields['id_event_text']) 
      ? r.fields['id_event_text'][0]?.trim() 
      : r.fields['id_event_text']?.trim();
    if (rawEventId) {
      usedEventIds.add(rawEventId);
    }
  }
  console.log(`[EVENTS] ${usedEventIds.size} événements référencés par participations`);
  
  // ÉTAPE 3: Sync événements staging si nécessaire
  const publishedEventIds = new Set(publishedEvents?.map((e: any) => e.id_event).filter(Boolean) ?? []);
  const eventsOnlyInStaging = stagingEvents?.filter((se: any) => 
    se.id_event && 
    !publishedEventIds.has(se.id_event) &&
    usedEventIds.has(se.id_event)
  ) ?? [];

  if (eventsOnlyInStaging.length > 0) {
    console.log(`[SYNC] ${eventsOnlyInStaging.length} événements staging→events...`);
    
    const { error: syncError } = await supabaseClient
      .from('events')
      .upsert(
        eventsOnlyInStaging.map((e: any) => {
          const { id, ...eventData } = e;
          return {
            ...eventData,
            visible: false,
            updated_at: new Date().toISOString()
          };
        }),
        { onConflict: 'id_event' }
      );
      
    if (syncError) {
      console.error('[SYNC ERROR]', syncError);
      return { 
        participationsImported: 0, 
        participationErrors: [{ 
          record_id: 'SYNC_ERROR', 
          reason: `Erreur sync: ${syncError.message}` 
        }] 
      };
    }
    
    // MAJ mapping
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
  }
  
  // ÉTAPE 4: Charger exposants par lots
  console.log('[EXPOSANTS] Chargement...');
  const allExposants: Array<{ id_exposant: string; website_exposant: string | null }> = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: page, error } = await supabaseClient
      .from('exposants')
      .select('id_exposant, website_exposant')
      .range(offset, offset + pageSize - 1);
    
    if (error || !page || page.length === 0) break;
    allExposants.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  
  console.log(`[EXPOSANTS] ${allExposants.length} chargés`);
  
  // Fonction de normalisation
  function normalizeDomain(input?: string|null): string|null {
    if (!input) return null;
    let s = input.trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
    s = s.split('/')[0].split('#')[0].split('?')[0];
    s = s.replace(/\.$/, '').replace(/:\d+$/, '');
    return s || null;
  }

  // Créer mapping website -> id_exposant
  const websiteToExposantMap = new Map<string, string>();
  allExposants.forEach((e: any) => {
    if (e.website_exposant && e.id_exposant) {
      const normalized = normalizeDomain(e.website_exposant);
      if (normalized) {
        websiteToExposantMap.set(normalized, e.id_exposant);
      }
    }
  });
  console.log(`[MAPPING] ${websiteToExposantMap.size} websites mappés`);
  
  // ÉTAPE 5: Préparer participations
  const toInsert = [];
  const participationErrors: Array<{ record_id: string; reason: string }> = [];

  for (const r of allParticipations) {
    const f = r.fields;
    const recordId = r.id;

    const rawEventField = f['id_event_text'];
    const eventIdText = Array.isArray(rawEventField) ? rawEventField[0]?.trim() : rawEventField?.trim();
    
    if (!eventIdText || !allEventIds.has(eventIdText)) {
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
    
    const exposantId = websiteToExposantMap.get(normalizedWebsite);
    if (!exposantId) {
      participationErrors.push({ record_id: recordId, reason: `exposant non trouvé: ${normalizedWebsite}` });
      continue;
    }

    const standInfo = f['stand_exposant']?.trim() || '';
    const urlExpoKey = `${eventIdText}_${normalizedWebsite}_${standInfo}`;
    const eventUuid = eventIdToUuidMap.get(eventIdText);

    toInsert.push({
      urlexpo_event: urlExpoKey,
      id_event_text: eventIdText,
      id_event: eventUuid || null,
      id_exposant: exposantId,
      stand_exposant: standInfo || null,
      website_exposant: websiteExposant,
      created_at: new Date().toISOString()
    });
  }

  // Dédupliquer
  const uniqueMap = new Map<string, typeof toInsert[0]>();
  for (const item of toInsert) {
    uniqueMap.set(item.urlexpo_event, item);
  }
  const deduplicatedInsert = Array.from(uniqueMap.values());
  
  console.log(`[PREP] ${deduplicatedInsert.length} participations à insérer (${toInsert.length - deduplicatedInsert.length} doublons, ${participationErrors.length} erreurs)`);

  // ÉTAPE 6: Insertion par lots
  let participationsImported = 0;
  
  if (deduplicatedInsert.length > 0) {
    const { inserted, errors } = await batchUpsert(
      supabaseClient,
      'participation',
      deduplicatedInsert,
      'urlexpo_event',
      SUPABASE_BATCH_SIZE
    );
    
    participationsImported = inserted;
    errors.forEach(err => participationErrors.push({ record_id: 'BATCH', reason: err }));
  }

  console.log(`[DONE] ${participationsImported} participations importées`);

  return { 
    participationsImported,
    participationErrors
  };
}
