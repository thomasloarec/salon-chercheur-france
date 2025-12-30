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
  
  // Fonction de normalisation de domaine pour matcher les exposants
  function normalizeDomain(input?: string|null): string|null {
    if (!input) return null;
    let s = input.trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '');
    s = s.replace(/^www\./, '');
    s = s.split('/')[0].split('#')[0].split('?')[0];
    s = s.replace(/\.$/, '');
    return s || null;
  }

  // Mapping exposants par website_exposant normalisé -> id_exposant
  const { data: exposants } = await supabaseClient
    .from('exposants')
    .select('id_exposant, website_exposant');
  
  const websiteToExposantMap = new Map<string, string>();
  exposants?.forEach((e: any) => {
    if (e.website_exposant && e.id_exposant) {
      const normalized = normalizeDomain(e.website_exposant);
      if (normalized) {
        websiteToExposantMap.set(normalized, e.id_exposant);
      }
    }
  });
  console.log(`[MAPPING] ${websiteToExposantMap.size} exposants avec website chargés pour matching`);
  
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

    // Matcher l'exposant via website_exposant
    const rawWebsite = f['website_exposant'];
    const websiteExposant = Array.isArray(rawWebsite) ? rawWebsite[0]?.trim() : rawWebsite?.trim();
    const normalizedWebsite = normalizeDomain(websiteExposant);
    
    if (!normalizedWebsite) {
      participationErrors.push({
        record_id: recordId,
        reason: `website_exposant manquant ou invalide`
      });
      continue;
    }
    
    // Trouver l'exposant correspondant via son website
    const exposantId = websiteToExposantMap.get(normalizedWebsite);
    if (!exposantId) {
      participationErrors.push({
        record_id: recordId,
        reason: `exposant non trouvé pour website: ${normalizedWebsite}`
      });
      continue;
    }

    const standInfo = f['stand_exposant']?.trim() || '';
    
    // Clé unique pour déduplication: domaine_stand (ex: "energycomposite.com.tw_5N44")
    const urlExpoKey = `${normalizedWebsite}_${standInfo}`;
    
    // Récupérer l'UUID de l'événement pour référence (optionnel)
    const eventUuid = eventIdToUuidMap.get(eventIdText);

    toInsert.push({
      urlexpo_event: urlExpoKey,           // Clé unique pour déduplication
      id_event_text: eventIdText,          // Clé principale Event_XX
      id_event: eventUuid || null,         // UUID en référence (nullable)
      id_exposant: exposantId,             // id_exposant Airtable
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