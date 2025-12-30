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
    supabaseClient.from('staging_events_import').select(`
      id, id_event, nom_event, date_debut, date_fin, ville, secteur,
      url_image, url_site_officiel, description_event, nom_lieu, 
      rue, code_postal, type_event, tarif, affluence
    `)
  ]);
  
  // Créer un mapping id_event_text -> UUID pour la résolution
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
  console.log(`[MAPPING] ${allEventIds.size} événements uniques trouvés (publiés + staging)`);
  
  // Charger toutes les participations d'Airtable avec pagination pour analyser les besoins
  const allParticipations = await fetchAllParticipations(airtableConfig);
  console.log('[DEBUG] participations records =', allParticipations.length);

  // Debug premier record
  if (allParticipations.length > 0) {
    console.log('[DEBUG] Premier record participation brut:', allParticipations[0].fields);
  }

  // Extraire les id_event utilisés par les participations
  const usedEventIds = new Set<string>();
  for (const r of allParticipations) {
    const rawEventId = Array.isArray(r.fields['id_event_text']) 
      ? r.fields['id_event_text'][0]?.trim() 
      : r.fields['id_event_text']?.trim();
    if (rawEventId) {
      usedEventIds.add(rawEventId);
    }
  }
  console.log(`[SYNC] ${usedEventIds.size} événements uniques utilisés par les participations`);
  
  // ÉTAPE INTERMÉDIAIRE: Synchroniser les événements staging manquants vers events
  console.log('[SYNC] Synchronisation des événements staging vers events...');
  const publishedEventIds = new Set(publishedEvents?.map((e: any) => e.id_event).filter(Boolean) ?? []);
  const eventsOnlyInStaging = stagingEvents?.filter((se: any) => 
    se.id_event && 
    !publishedEventIds.has(se.id_event) &&
    usedEventIds.has(se.id_event) // Uniquement les événements utilisés par les participations
  ) ?? [];

  if (eventsOnlyInStaging.length > 0) {
    console.log(`[SYNC] ${eventsOnlyInStaging.length} événements à synchroniser depuis staging...`);
    
    const { error: syncError } = await supabaseClient
      .from('events')
      .upsert(
        eventsOnlyInStaging.map((e: any) => {
          const { id, ...eventData } = e; // Exclure l'id interne de staging
          return {
            ...eventData,
            visible: false, // Marquer comme invisible car non validé
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
          reason: `Erreur sync staging→events: ${syncError.message}` 
        }] 
      };
    }
    
    const syncedEventsCount = eventsOnlyInStaging.length;
    console.log(`[SYNC] ${syncedEventsCount} événements synchronisés avec visible=false`);
    console.log(`[METRICS] ${syncedEventsCount} événements staging→events synchronisés`);
    
    // Mettre à jour allEventIds avec les événements nouvellement synchronisés  
    const newlySyncedIds = eventsOnlyInStaging.map((e: any) => e.id_event).filter(Boolean);
    newlySyncedIds.forEach((id: any) => allEventIds.add(id));
    console.log(`[SYNC] allEventIds mis à jour, total: ${allEventIds.size} événements`);
    
    // Mettre à jour le mapping avec les événements synchronisés (récupérer leurs nouveaux UUID)
    const { data: newlyCreatedEvents } = await supabaseClient
      .from('events')
      .select('id, id_event')
      .in('id_event', newlySyncedIds);
    
    newlyCreatedEvents?.forEach((e: any) => {
      if (e.id_event && e.id) {
        eventIdToUuidMap.set(e.id_event, e.id);
      }
    });
  } else {
    console.log('[SYNC] Aucun événement staging à synchroniser');
  }
  
  // Mapping exposants par id_exposant (clé Airtable)
  const { data: exposants } = await supabaseClient
    .from('exposants')
    .select('id_exposant');
  
  const exposantIdSet = new Set<string>();
  exposants?.forEach((e: any) => {
    if (e.id_exposant) {
      exposantIdSet.add(e.id_exposant);
    }
  });
  console.log(`[MAPPING] ${exposantIdSet.size} exposants chargés pour validation`);
  
  // Les participations sont déjà chargées plus haut

  // Préparer batch d'insertion
  const toInsert = [];
  const participationErrors: Array<{ record_id: string; reason: string }> = [];

  for (const r of allParticipations) {
    const f = r.fields;
    const recordId = r.id;

    const rawEventField = f['id_event_text'];
    const eventIdText = Array.isArray(rawEventField) ? rawEventField[0]?.trim() : rawEventField?.trim();
    
    if (!eventIdText) {
      participationErrors.push({
        record_id: recordId,
        reason: 'id_event_text manquant ou vide'
      });
      continue;
    }

    // Vérifier que l'événement existe (dans published ou staging)
    if (!allEventIds.has(eventIdText)) {
      participationErrors.push({
        record_id: recordId,
        reason: `événement ${eventIdText} introuvable`
      });
      continue;
    }

    // Récupérer id_exposant directement depuis Airtable (linked record ou lookup)
    const rawExposantId = f['id_exposant'];
    const exposantId = Array.isArray(rawExposantId) ? rawExposantId[0]?.trim() : rawExposantId?.trim();
    
    if (!exposantId) {
      participationErrors.push({
        record_id: recordId,
        reason: `id_exposant manquant`
      });
      continue;
    }
    
    // Vérifier que l'exposant existe en base
    if (!exposantIdSet.has(exposantId)) {
      participationErrors.push({
        record_id: recordId,
        reason: `exposant ${exposantId} non trouvé en base`
      });
      continue;
    }

    const standInfo = f['stand_exposant']?.trim() || '';
    const websiteExposant = f['website_exposant']?.trim() || null;
    
    // Utiliser nom_exposant_stand comme clé unique si disponible, sinon construire depuis id_exposant + stand
    const nomExposantStand = f['nom_exposant_stand']?.trim();
    const urlExpoKey = nomExposantStand || `${exposantId}_${standInfo}`;
    
    // Récupérer l'UUID de l'événement pour référence (optionnel)
    const eventUuid = eventIdToUuidMap.get(eventIdText);

    toInsert.push({
      urlexpo_event: urlExpoKey,           // Clé unique pour déduplication
      id_event_text: eventIdText,          // Clé principale Event_XX
      id_event: eventUuid || null,         // UUID en référence (nullable)
      id_exposant: exposantId,             // id_exposant Airtable (ex: Exporec0HdpGKPar9ae8Q)
      stand_exposant: standInfo || null,  
      website_exposant: websiteExposant,
      created_at: new Date().toISOString()
    });
  }

  // Métriques avant insertion
  const rejectedCount = participationErrors.length;
  const validCount = toInsert.length;
  console.log(`[METRICS] Participations: ${validCount} valides, ${rejectedCount} rejetées`);

  // Upsert avec clé composite
  console.log(`Insertion de ${toInsert.length} participations...`);
  let participationsImported = 0;
  
  if (toInsert.length > 0) {
    try {
      const { data, error } = await supabaseClient
        .from('participation')
        .upsert(toInsert, { onConflict: 'urlexpo_event' })
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
        reason: `Exception: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  // Récapitulatif final
  const syncedEventsCount = eventsOnlyInStaging?.length || 0;
  console.log(`
[RÉCAPITULATIF IMPORT PARTICIPATION]
- Événements synchronisés staging→events: ${syncedEventsCount}
- Participations valides à insérer: ${toInsert.length}
- Participations rejetées: ${participationErrors.length}
- Participations effectivement importées: ${participationsImported}
- Taux de succès: ${toInsert.length > 0 ? Math.round(participationsImported/toInsert.length*100) : 0}%
`);

  return { 
    participationsImported,
    participationErrors
  };
}