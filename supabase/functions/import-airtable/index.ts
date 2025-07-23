
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🚧 MODE DEBUG ROOT-CAUSE 🚧
const DEBUG_ROOT_CAUSE = true;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

// Convertit 'DD/MM/YYYY' ou 'D/M/YY' en 'YYYY-MM-DD'
function normalizeDate(input: string | null): string | null {
  if (!input || input.trim() === '') return null;
  // Si déjà au format YYYY-MM-DD, on renvoie tel quel
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  // Pattern DD/MM/YYYY
  const m = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null; // format inconnu
  const [, d, mth, y] = m;
  // 2-digit year → 20xx
  const year = y.length === 2 ? `20${y}` : y.padStart(4, '0');
  const month = mth.padStart(2, '0');
  const day = d.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Mapping vers les valeurs autorisées par la contrainte CHECK
const EVENT_TYPE_ALLOWED = ['salon', 'conference', 'congres', 'convention', 'ceremonie'];

function normalizeEventType(raw: string | null): string {
  if (!raw) return 'salon';
  
  const normalized = raw.toLowerCase().trim();
  
  // Mapping des variantes vers les valeurs autorisées
  const mappings: Record<string, string> = {
    'salon': 'salon',
    'salons': 'salon',
    'congrès': 'congres',
    'congres': 'congres',
    'congress': 'congres',
    'conférence': 'conference',
    'conference': 'conference',
    'convention': 'convention',
    'conventions': 'convention',
    'cérémonie': 'ceremonie',
    'ceremonie': 'ceremonie',
    'ceremony': 'ceremonie'
  };
  
  // Chercher d'abord dans les mappings exacts
  if (mappings[normalized]) {
    return mappings[normalized];
  }
  
  // Si pas trouvé, chercher une correspondance partielle
  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  // Par défaut, retourner salon
  return 'salon';
}

interface AirtableEventRecord {
  id: string;
  fields: {
    'ID_Event': string;
    'Nom_Event': string;
    'Status_Event': string;
    'Type_Event': string;
    'Date_debut': string;
    'Date_Fin': string;
    'Secteur': string;
    'URL_image': string;
    'URL_site_officiel': string;
    'Description_Event': string;
    'Affluence': string;
    'Tarifs': string;
    'Nom_Lieu': string;
    'Rue': string;
    'Code_Postal': string;
    'Ville': string;
  };
}

interface AirtableExposantRecord {
  id: string;
  fields: {
    'ID_Event': string;
    'exposant_nom': string;
    'exposant_stand': string;
    'exposant_website': string;
    'exposant_description': string;
  };
}

// Expected field mappings for debug
const expectedEventFields = ['ID_Event', 'Nom_Event', 'Status_Event', 'Type_Event', 'Date_debut', 'Date_Fin', 'Secteur', 'URL_image', 'URL_site_officiel', 'Description_Event', 'Affluence', 'Tarifs', 'Nom_Lieu', 'Rue', 'Code_Postal', 'Ville'];
const expectedExposantFields = ['All_Events', 'nom_exposant', 'id_exposant', 'website_exposant', 'exposant_description'];
const expectedParticipationFields = ['id_event', 'id_exposant', 'stand_exposant', 'website_exposant', 'urlexpo_event'];

// Import functions
async function importEvents(supabaseClient: any, airtableConfig: { pat: string, baseId: string }) {
  console.log('Importing events...');
  const url = `https://api.airtable.com/v0/${airtableConfig.baseId}/All_Events`;
  
  if (DEBUG_ROOT_CAUSE) {
    console.log('[DEBUG_ROOT] Fetch URL:', url);
  }
  
  const eventsResponse = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${airtableConfig.pat}`,
      'Content-Type': 'application/json'
    }
  });

  if (DEBUG_ROOT_CAUSE) {
    console.log('[DEBUG_ROOT] Events HTTP Status:', eventsResponse.status);
  }

  if (!eventsResponse.ok) {
    throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
  }

  const eventsData = await eventsResponse.json();
  
  if (DEBUG_ROOT_CAUSE) {
    console.log('[DEBUG_ROOT] Events payload size:', eventsData.records?.length || 0);
  }
  console.log('[DEBUG] Nombre d\'événements récupérés depuis Airtable :', eventsData.records?.length || 0);
  console.log('[DEBUG] Exemple de 5 événements :', eventsData.records?.slice(0,5) || []);
  const eventsToInsert: any[] = [];

  // DEBUG ROOT-CAUSE: Inspection détaillée des mappings
  if (DEBUG_ROOT_CAUSE && eventsData.records?.length > 0) {
    const sampleIndices = [0, Math.floor(eventsData.records.length / 2), eventsData.records.length - 1];
    for (const idx of sampleIndices) {
      if (eventsData.records[idx]) {
        const record = eventsData.records[idx];
        console.log(`[DEBUG_ROOT] Event sample ${idx}:`);
        console.log(`[DEBUG_ROOT] - record.id: ${record.id}`);
        console.log(`[DEBUG_ROOT] - Object.keys(record.fields): ${JSON.stringify(Object.keys(record.fields))}`);
        console.log(`[DEBUG_ROOT] - ID_Event: ${record.fields['ID_Event']}`);
        console.log(`[DEBUG_ROOT] - Nom_Event: ${record.fields['Nom_Event']}`);
        console.log(`[DEBUG_ROOT] - Status_Event: ${record.fields['Status_Event']}`);
      }
    }
    
    // Rapport différentiel
    const actualEventFields = Object.keys(eventsData.records[0].fields);
    const missingFields = expectedEventFields.filter(f => !actualEventFields.includes(f));
    const extraFields = actualEventFields.filter(f => !expectedEventFields.includes(f));
    console.warn('[DEBUG_ROOT] Fields mismatch EVENTS:');
    console.warn('[DEBUG_ROOT] - Missing fields:', missingFields);
    console.warn('[DEBUG_ROOT] - Extra fields:', extraFields);
  }

  for (const record of eventsData.records) {
    const fields = record.fields;
    
    // Only process approved events
    if (fields['Status_Event']?.toLowerCase() !== 'approved') {
      continue;
    }

    const eventData = {
      id: fields['ID_Event'],
      nom_event: fields['Nom_Event'] || '',
      status_event: fields['Status_Event'] || '',
      type_event: normalizeEventType(fields['Type_Event']),
      date_debut: normalizeDate(fields['Date_debut']),
      date_fin: normalizeDate(fields['Date_Fin']),
      secteur: fields['Secteur'] || '',
      url_image: fields['URL_image'] || null,
      url_site_officiel: fields['URL_site_officiel'] || null,
      description_event: fields['Description_Event'] || null,
      affluence: fields['Affluence'] && fields['Affluence'].trim() !== '' ? fields['Affluence'] : null,
      tarifs: fields['Tarifs'] || null,
      nom_lieu: fields['Nom_Lieu'] || null,
      rue: fields['Rue'] || null,
      code_postal: fields['Code_Postal'] || null,
      ville: fields['Ville'] || 'Inconnue'
    };

    if (eventData.id) {
      eventsToInsert.push(eventData);
    }
  }

  // DEBUG ROOT-CAUSE: Comptage avant insertion
  if (DEBUG_ROOT_CAUSE) {
    console.log(`[DEBUG_ROOT] eventsToInsert.length=${eventsToInsert.length}`);
  }

  let eventsImported = 0;

  // Insert events into Supabase events_import table
  if (eventsToInsert.length > 0) {
    console.log(`[DEBUG] Insertion de ${eventsToInsert.length} enregistrements dans la table events_import`);
    const { data: eventsData, error: eventsError } = await supabaseClient
      .from('events_import')
      .upsert(eventsToInsert, { onConflict: 'id' })
      .select();

    if (eventsError) {
      console.error(`[ERROR] Échec insertion dans events_import :`, eventsError);
      throw new Error(`Failed to insert events: ${eventsError.message}`);
    } else {
      console.log(`[DEBUG] ${eventsData?.length || 0} enregistrements insérés avec succès dans events_import`);
    }

    eventsImported = eventsToInsert.length;
    console.log(`Imported ${eventsImported} events`);

    // Promote to production events table
    const productionEvents = eventsToInsert.map(ev => ({
      id_event: ev.id,
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
      affluence: ev.affluence ? parseInt(ev.affluence) : null,
      tarif: ev.tarifs,
      nom_lieu: ev.nom_lieu,
      location: ev.ville || 'Inconnue'
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
      throw new Error(`Failed to upsert production events: ${prodError.message}`);
    } else {
      console.log(`[DEBUG] ${prodData?.length || 0} enregistrements insérés avec succès dans events`);
    }

    console.log(`Promoted ${productionEvents.length} events to production`);
  }

  return eventsImported;
}

async function importExposants(supabaseClient: any, airtableConfig: { pat: string, baseId: string }) {
  console.log('Importing exposants standalone...');
  const resp = await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/All_Exposants`, {
    headers: { 'Authorization': `Bearer ${airtableConfig.pat}` }
  });
  if (!resp.ok) throw new Error(`Fetch exposants failed: ${resp.status}`);
  const { records } = await resp.json();
  console.log('[DEBUG] exposants records:', records.length);

  const exposantsToUpsert = records
    .map((r: any) => {
      const f = r.fields;
      return {
        id_exposant: f['id_exposant']?.trim(),
        nom_exposant: f['nom_exposant']?.trim(),
        website_exposant: f['website_exposant']?.trim() || null,
        exposant_description: f['exposant_description']?.trim() || null
      };
    })
    .filter((e: any) => e.id_exposant && e.nom_exposant);

  console.log('[DEBUG] exposantsToUpsert.length =', exposantsToUpsert.length);
  if (exposantsToUpsert.length) {
    const { data, error } = await supabaseClient
      .from('exposants')
      .upsert(exposantsToUpsert, { onConflict: 'id_exposant' })
      .select();
    if (error) throw new Error(`Supabase exposants upsert error: ${error.message}`);
    console.log('[DEBUG] exposants upserted:', data.length);
    return data.length;
  }
  return 0;
}

async function importParticipation(supabaseClient: any, airtableConfig: { pat: string, baseId: string }, exposantMapByUrl: Map<string, string>) {
  console.log('Importing participation...');
  const resp = await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/Participation`, {
    headers: { 'Authorization': `Bearer ${airtableConfig.pat}` }
  });
  if (!resp.ok) throw new Error(`Fetch participation failed: ${resp.status}`);
  const { records } = await resp.json();
  console.log('[DEBUG] participations records =', records.length);

  // Avant la boucle
  console.log('[DEBUG] Premier record participation brut:', records[0].fields);

  const toInsert = [];
  for (const r of records) {
    const f = r.fields;
    
    // Extraction de l'ID d'événement
    const rawEventField = r.fields['id_event'];
    const idEvent = Array.isArray(rawEventField) ? rawEventField[0] : rawEventField;
    console.log(`[DEBUG] participation ${r.id} idEvent extrait =`, idEvent);
    
    // Vérification du champ website_exposant
    const rawUrlField = r.fields['website_exposant'];
    const rawUrl = Array.isArray(rawUrlField) ? rawUrlField[0] : rawUrlField;
    console.log(`[DEBUG] participation ${r.id} rawUrl = "${rawUrl}" (type ${typeof rawUrl})`);
    
    const key = rawUrl.trim().toLowerCase();
    const exposantId = exposantMapByUrl.get(key);
    if (!idEvent) {
      console.warn(`[WARN] Skip – missing id_event for participation ${r.id}`);
      continue;
    }
    if (!exposantId) {
      console.error(`[ERROR] Skip participation – URL introuvable dans map:
    record=${r.id}
    rawUrl="${rawUrl}"
    exposantMapByUrl.has(rawUrl.trim().toLowerCase())?`, exposantMapByUrl.has(rawUrl.trim().toLowerCase()));
      continue;
    }
    toInsert.push({
      id_event: idEvent,
      id_exposant: exposantId,
      stand_exposant: f['stand_exposant']?.trim() || null,
      website_exposant: rawUrl.trim(),
      urlexpo_event: f['urlexpo_event']?.trim() || null
    });
  }
  console.log('[DEBUG] participationToInsert.length =', toInsert.length);
  if (toInsert.length) {
    const { data, error } = await supabaseClient
      .from('participation')
      .insert(toInsert)
      .select();
    if (error) throw new Error(`Insert participation failed: ${error.message}`);
    console.log('[DEBUG] participations inserted =', data.length);
    return data.length;
  }
  return 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
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

      // 1. Import des événements
      const eventsImported = await importEvents(supabaseClient, airtableConfig);
      console.log('[DEBUG] eventsImported =', eventsImported);

      // 2. Import des exposants (toujours exécuté)
      const exposantsImported = await importExposants(supabaseClient, airtableConfig);
      console.log('[DEBUG] exposantsImported =', exposantsImported);

      // Charger les exposants existants depuis Supabase pour le mapping
      const { data: existingExposants, error: exposantsFetchError } = await supabaseClient
        .from('exposants')
        .select('id_exposant, nom_exposant');
      if (exposantsFetchError) {
        console.error('[ERROR] Fetch exposants pour mapping participation failed:', exposantsFetchError);
        throw new Error('Failed to load exposants for participation mapping');
      }
      // Construire un map exposant par URL
      const { data: existingExposantsForUrl } = await supabaseClient
        .from('exposants')
        .select('id_exposant, website_exposant');
      const exposantMapByUrl = new Map(
        existingExposantsForUrl
          .filter((e: any) => e.website_exposant)
          .map((e: any) => [e.website_exposant.trim().toLowerCase(), e.id_exposant])
      );
      console.log('[DEBUG] exposantMapByUrl size =', exposantMapByUrl.size);
      
      // Inspecter le map d'exposants
      console.log('[DEBUG] Clés exposantMapByUrl (10 premières) =', Array.from(exposantMapByUrl.keys()).slice(0,10));
      console.log('[DEBUG] Valeur map pour "elidose.com" =', exposantMapByUrl.get('elidose.com'));
      console.log('[DEBUG] Valeur map pour "nuonmedical.com" =', exposantMapByUrl.get('nuonmedical.com'));

      // 3. Import des participations (toujours exécuté)
      const participationsImported = await importParticipation(supabaseClient, airtableConfig, exposantMapByUrl);
      console.log('[DEBUG] participationsImported =', participationsImported);

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
        
        // Note: Dans Deno edge functions, on ne peut pas écrire dans /tmp
        // Le rapport est disponible dans les logs de la fonction
      }

      // Summary response
      const summary = {
        success: true,
        eventsImported,
        exposantsImported,
        participationsImported,
        message: `Import completed: ${eventsImported} events, ${exposantsImported} exposants and ${participationsImported} participations imported`,
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
        error: error.message 
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
