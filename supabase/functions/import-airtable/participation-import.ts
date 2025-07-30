import { normalizeUrl } from '../_shared/normalization-utils.ts';
import type { 
  AirtableParticipationRecord, 
  ParticipationImportResult, 
  AirtableConfig,
  AirtableResponse 
} from '../_shared/types.ts';

async function fetchAllParticipations(airtableConfig: AirtableConfig): Promise<AirtableParticipationRecord[]> {
  const allRecords: AirtableParticipationRecord[] = [];
  let offset: string | undefined;
  
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
    
    console.log(`[DEBUG] Fetched ${data.records.length} participations, total: ${allRecords.length}`);
  } while (offset);
  
  return allRecords;
}

export async function importParticipation(supabaseClient: any, airtableConfig: AirtableConfig): Promise<ParticipationImportResult> {
  console.log('Importing participation simplifiée...');
  
  // ÉTAPE PRÉLIMINAIRE: Charger tous les événements (publiés + staging) pour validation
  console.log('[MAPPING] Chargement des événements publiés et en staging...');
  const [{ data: publishedEvents }, { data: stagingEvents }] = await Promise.all([
    supabaseClient.from('events').select('id, id_event'),
    supabaseClient.from('staging_events_import').select('id, id_event')
  ]);
  
  const allEventIds = new Set<string>([
    ...(publishedEvents?.map((e: any) => e.id_event).filter(Boolean) ?? []),
    ...(stagingEvents?.map((e: any) => e.id_event).filter(Boolean) ?? [])
  ]);
  console.log(`[MAPPING] ${allEventIds.size} événements uniques trouvés (publiés + staging)`);
  
  // Mapping exposants en amont
  const { data: exposants } = await supabaseClient
    .from('exposants')
    .select('id_exposant, website_exposant');
  
  const exposantMap = new Map<string, string>();
  exposants?.forEach((e: any) => {
    if (e.website_exposant) {
      exposantMap.set(normalizeUrl(e.website_exposant), e.id_exposant);
    }
  });
  
  // Charger toutes les participations d'Airtable avec pagination
  const allParticipations = await fetchAllParticipations(airtableConfig);
  console.log('[DEBUG] participations records =', allParticipations.length);

  // Debug premier record
  if (allParticipations.length > 0) {
    console.log('[DEBUG] Premier record participation brut:', allParticipations[0].fields);
  }

  // Préparer batch d'insertion
  const toInsert = [];
  const participationErrors: Array<{ record_id: string; reason: string }> = [];

  for (const r of allParticipations) {
    const f = r.fields;
    const recordId = r.id;

    // Extraire urlexpo_event
    const rawUrlField = f['urlexpo_event'];
    const rawUrlKey = Array.isArray(rawUrlField) ? rawUrlField[0] : rawUrlField;
    
    if (!rawUrlKey) {
      participationErrors.push({ 
        record_id: recordId, 
        reason: 'urlexpo_event manquant'
      });
      continue;
    }
    const urlKey = rawUrlKey.trim();

    const rawEventField = f['id_event_text'];
    const rawEventId = Array.isArray(rawEventField) ? rawEventField[0]?.trim() : rawEventField?.trim();

    // Validation existence de l'événement (publiés + staging)
    const exists = allEventIds.has(rawEventId);
    if (!exists) {
      participationErrors.push({
        record_id: recordId,
        reason: `event non trouvé dans Supabase (${rawEventId})`
      });
      continue;
    }

    // mapping exposant
    const rawWeb = f['website_exposant'];
    const normalizedWeb = normalizeUrl(rawWeb || '');
    const exposantId = exposantMap.get(normalizedWeb);
    
    if (!exposantId) {
      participationErrors.push({
        record_id: recordId,
        reason: `exposant introuvable (${normalizedWeb})`
      });
      continue;
    }

    toInsert.push({
      urlexpo_event: urlKey,
      id_event: rawEventId, // Utiliser la valeur texte directement
      id_exposant: exposantId,
      stand_exposant: f['stand_exposant']?.trim() || null,
      website_exposant: normalizedWeb
    });
  }

  // Upsert avec clé composite
  console.log(`Insertion de ${toInsert.length} participations...`);
  let participationsImported = 0;
  
  if (toInsert.length > 0) {
    try {
      const { data, error } = await supabaseClient
        .from('participation')
        .upsert(toInsert, { onConflict: 'id_event,id_exposant' })
        .select();
      
      if (error) {
        console.error('[ERROR] Participation upsert error:', error);
        participationErrors.push({
          record_id: 'UPSERT_ERROR',
          reason: `Erreur upsert: ${error.message}`
        });
        return { participationsImported: 0, participationErrors };
      }
      
      participationsImported = data?.length || 0;
      console.log(`${participationsImported} participations insérées`);
    } catch (error) {
      console.error('[ERROR] Exception during participation import:', error);
      participationErrors.push({
        record_id: 'EXCEPTION_ERROR',
        reason: `Exception: ${error.message}`
      });
    }
  }

  return { 
    participationsImported,
    participationErrors
  };
}