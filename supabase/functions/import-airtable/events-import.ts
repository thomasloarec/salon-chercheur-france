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
      throw new Error(`Failed to fetch events: ${response.status}`);
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

  // Insert events into Supabase events_import table
  if (eventsToInsert.length > 0) {
    console.log(`[DEBUG] Insertion de ${eventsToInsert.length} enregistrements dans la table staging_events_import`);
    
    try {
      const { data: eventsData, error: eventsError } = await supabaseClient
        .from('staging_events_import')
        .upsert(eventsToInsert, { onConflict: 'id_event' })
        .select();

      if (eventsError) {
        console.error(`[ERROR] Échec insertion dans staging_events_import :`, eventsError);
        // Ajouter les erreurs d'upsert aux eventErrors plutôt que de throw
        eventErrors.push({
          record_id: 'UPSERT_ERROR',
          reason: `Erreur upsert staging: ${eventsError.message}`
        });
        return { eventsImported: 0, eventErrors };
      } else {
        console.log(`[DEBUG] ${eventsData?.length || 0} enregistrements insérés avec succès dans staging_events_import`);
      }

      eventsImported = eventsToInsert.length;
      console.log(`Imported ${eventsImported} events`);

      // Promote to production events table
      const productionEvents = eventsToInsert.map(ev => ({
        id_event: ev.id_event,
        airtable_id: ev.airtable_id,
        nom_event: ev.nom_event,
        visible: false, // Default invisible
        type_event: ev.type_event,
        date_debut: ev.date_debut || '1970-01-01',
        date_fin: ev.date_fin || ev.date_debut || '1970-01-01',
        secteur: [ev.secteur || 'Autre'], // Convert to jsonb array
        ville: ev.ville,
        rue: ev.rue,
        code_postal: ev.code_postal,
        pays: 'France',
        url_image: ev.url_image,
        url_site_officiel: ev.url_site_officiel,
        description_event: ev.description_event,
        affluence: ev.affluence ? (isNaN(parseInt(ev.affluence)) ? ev.affluence : parseInt(ev.affluence)) : null,
        tarif: ev.tarif,
        nom_lieu: ev.nom_lieu,
        location: ev.ville || 'Inconnue',
        slug: null // Laisser NULL pour déclencher le trigger auto_generate_event_slug
      }));

      console.log(`[DEBUG] Insertion de ${productionEvents.length} enregistrements dans la table events`);
      const { data: prodData, error: prodError } = await supabaseClient
        .from('events')
        .upsert(productionEvents, { 
          onConflict: 'id_event',
          ignoreDuplicates: false 
        })
        .select();

      if (prodError) {
        console.error(`[ERROR] Échec insertion dans events :`, prodError);
        eventErrors.push({
          record_id: 'PRODUCTION_UPSERT_ERROR',
          reason: `Erreur upsert production: ${prodError.message}`
        });
      } else {
        console.log(`[DEBUG] ${prodData?.length || 0} enregistrements insérés avec succès dans events`);
      }

      console.log(`Promoted ${productionEvents.length} events to production`);
      
      // Log de vérification airtable_id
      const { count } = await supabaseClient
        .from('events')
        .select('id', { count: 'exact' })
        .is('airtable_id', null);
      console.log('[DEBUG] Rows with NULL airtable_id after upsert:', count);
      
    } catch (error) {
      console.error('[ERROR] Exception during events import:', error);
      eventErrors.push({
        record_id: 'EXCEPTION_ERROR',
        reason: `Exception: ${error.message}`
      });
    }
  }

  return { eventsImported, eventErrors };
}