import { normalizeDate, normalizeEventType } from '../_shared/normalization-utils.ts';
import type { 
  AirtableEventRecord, 
  EventImportResult, 
  AirtableConfig,
  AirtableResponse 
} from '../_shared/types.ts';

const DEBUG_ROOT_CAUSE = true;

// Expected field mappings for debug
const expectedEventFields = ['id_event', 'nom_event', 'status_event', 'type_event', 'date_debut', 'date_fin', 'secteur', 'url_image', 'url_site_officiel', 'description_event', 'affluence', 'tarif', 'nom_lieu', 'rue', 'code_postal', 'ville'];

async function fetchAllEvents(airtableConfig: AirtableConfig): Promise<AirtableEventRecord[]> {
  const allRecords: AirtableEventRecord[] = [];
  let offset: string | undefined;
  
  do {
    const url = new URL(`https://api.airtable.com/v0/${airtableConfig.baseId}/All_Events`);
    if (offset) {
      url.searchParams.set('offset', offset);
    }
    
    if (DEBUG_ROOT_CAUSE) {
      console.log('[DEBUG_ROOT] Fetch URL:', url.toString());
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${airtableConfig.pat}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[ERROR] Airtable API error ${response.status}:`, errorBody);
      console.error(`[ERROR] PAT length: ${airtableConfig.pat?.length || 0}, Base ID: ${airtableConfig.baseId}`);
      
      if (response.status === 403) {
        throw new Error(`Airtable 403 Forbidden: Le PAT n'a pas accès à cette base ou est expiré. Vérifiez les permissions du PAT dans Airtable. Détails: ${errorBody}`);
      }
      throw new Error(`Failed to fetch events: ${response.status} - ${errorBody}`);
    }

    const data: AirtableResponse<AirtableEventRecord> = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;
    
    if (DEBUG_ROOT_CAUSE) {
      console.log(`[DEBUG_ROOT] Fetched ${data.records.length} events, total: ${allRecords.length}`);
    }
  } while (offset);
  
  return allRecords;
}

export async function importEvents(supabaseClient: any, airtableConfig: AirtableConfig): Promise<EventImportResult> {
  console.log('Importing events...');
  
  const allEvents = await fetchAllEvents(airtableConfig);
  
  if (DEBUG_ROOT_CAUSE) {
    console.log('[DEBUG_ROOT] Events payload size:', allEvents.length);
  }
  console.log('[DEBUG] Nombre d\'événements récupérés depuis Airtable :', allEvents.length);
  console.log('[DEBUG] Exemple de 5 événements :', allEvents.slice(0,5));
  
  const eventsToInsert: any[] = [];
  const eventErrors: Array<{ record_id: string; reason: string }> = [];

  // DEBUG ROOT-CAUSE: Inspection détaillée des mappings
  if (DEBUG_ROOT_CAUSE && allEvents.length > 0) {
    const sampleIndices = [0, Math.floor(allEvents.length / 2), allEvents.length - 1];
    for (const idx of sampleIndices) {
      if (allEvents[idx]) {
        const record = allEvents[idx];
        console.log(`[DEBUG_ROOT] Event sample ${idx}:`);
        console.log(`[DEBUG_ROOT] - record.id: ${record.id}`);
        console.log(`[DEBUG_ROOT] - Object.keys(record.fields): ${JSON.stringify(Object.keys(record.fields))}`);
        console.log(`[DEBUG_ROOT] - id_event: ${record.fields['id_event']}`);
        console.log(`[DEBUG_ROOT] - nom_event: ${record.fields['nom_event']}`);
        console.log(`[DEBUG_ROOT] - status_event: ${record.fields['status_event']}`);
      }
    }
    
    // Rapport différentiel
    const actualEventFields = Object.keys(allEvents[0].fields);
    const missingFields = expectedEventFields.filter(f => !actualEventFields.includes(f));
    const extraFields = actualEventFields.filter(f => !expectedEventFields.includes(f));
    console.warn('[DEBUG_ROOT] Fields mismatch EVENTS:');
    console.warn('[DEBUG_ROOT] - Missing fields:', missingFields);
    console.warn('[DEBUG_ROOT] - Extra fields:', extraFields);
  }

  for (const record of allEvents) {
    const fields = record.fields;
    
    // Only process approved events
    if (fields['status_event']?.toLowerCase() !== 'approved') {
      eventErrors.push({
        record_id: record.id,
        reason: `status_event ≠ approved (${fields['status_event'] || 'vide'})`
      });
      continue;
    }

    if (!fields['id_event']) {
      eventErrors.push({
        record_id: record.id,
        reason: 'id_event manquant'
      });
      continue;
    }

    const eventData = {
      airtable_id: record.id, // Stocker le vrai record ID Airtable
      id_event: fields['id_event'],
      nom_event: fields['nom_event'] || '',
      status_event: fields['status_event'] || '',
      type_event: normalizeEventType(fields['type_event']),
      date_debut: normalizeDate(fields['date_debut']),
      date_fin: normalizeDate(fields['date_fin']),
      secteur: fields['secteur'] || '',
      url_image: fields['url_image'] || null,
      url_site_officiel: fields['url_site_officiel'] || null,
      description_event: fields['description_event'] || null,
      affluence: fields['affluence'] && fields['affluence'].trim() !== '' ? fields['affluence'] : null,
      tarif: fields['tarif'] || null,
      nom_lieu: fields['nom_lieu'] || null,
      rue: fields['rue'] || null,
      code_postal: fields['code_postal'] || null,
      ville: fields['ville'] || 'Inconnue'
    };

    eventsToInsert.push(eventData);
  }

  // DEBUG ROOT-CAUSE: Comptage avant insertion
  if (DEBUG_ROOT_CAUSE) {
    console.log(`[DEBUG_ROOT] eventsToInsert.length=${eventsToInsert.length}`);
  }

  let eventsImported = 0;

  try {
    // Insert events into Supabase events_import table
    if (eventsToInsert.length > 0) {
      // 1) Récupérer les id_event déjà en production
      const candidateIds = eventsToInsert.map(e => e.id_event);
      const { data: existingInProd, error: fetchErr } = await supabaseClient
        .from('events')
        .select('id_event')
        .in('id_event', candidateIds);

      if (fetchErr) {
        console.error(`[ERROR] Échec récupération événements existants :`, fetchErr);
        eventErrors.push({
          record_id: 'FETCH_EXISTING_ERROR',
          reason: `Erreur fetch existing: ${fetchErr.message}`
        });
        return { eventsImported: 0, eventErrors };
      }

      const existingIds = new Set((existingInProd || []).map((e: any) => e.id_event));

      // 2) Ne conserver que les événements **nouveaux** pour le staging
      const newEventsForStaging = eventsToInsert.filter(e => 
        !existingIds.has(e.id_event)
      );

      console.log(`[DEBUG] ${newEventsForStaging.length} événements uniques à importer en staging (${existingIds.size} déjà existants ignorés)`);

      // 3) Upsert en staging uniquement des nouveaux
      if (newEventsForStaging.length > 0) {
        try {
          const { data: eventsData, error: eventsError } = await supabaseClient
            .from('staging_events_import')
            .upsert(newEventsForStaging, { onConflict: 'id_event' })
            .select();

          if (eventsError) {
            console.error(`[ERROR] Échec insertion dans staging_events_import :`, eventsError);
            eventErrors.push({
              record_id: 'UPSERT_ERROR',
              reason: `Erreur upsert staging: ${eventsError.message}`
            });
            return { eventsImported: 0, eventErrors };
          } else {
            console.log(`[DEBUG] ${eventsData?.length || 0} enregistrements insérés avec succès dans staging_events_import`);
          }
        } catch (error) {
          console.error('[ERROR] Exception during staging insert:', error);
          eventErrors.push({
            record_id: 'STAGING_INSERT_ERROR',
            reason: `Exception staging: ${error instanceof Error ? error.message : String(error)}`
          });
          return { eventsImported: 0, eventErrors };
        }
      }

      // Stratégie A : Import staging uniquement - pas de promotion automatique vers events
      eventsImported = newEventsForStaging.length;
      console.log(`[DEBUG] Import terminé : ${eventsImported} événements ajoutés au staging`);
      console.log(`[DEBUG] Publication manuelle requise via publish-pending ou admin`);
    }
  } catch (error) {
    console.error('[ERROR] Exception during events import:', error);
    eventErrors.push({
      record_id: 'EXCEPTION_ERROR',
      reason: `Exception: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return { eventsImported, eventErrors };
}