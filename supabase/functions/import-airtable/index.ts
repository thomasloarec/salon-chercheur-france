import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

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

// Fonction pour récupérer tous les enregistrements d'une table Airtable avec pagination
async function fetchAllAirtableRecords(baseId: string, tableName: string, apiKey: string): Promise<any[]> {
  const allRecords: any[] = [];
  let offset: string | undefined;
  
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableName}`);
    if (offset) {
      url.searchParams.set('offset', offset);
    }
    
    console.log(`📡 Fetching ${tableName} records${offset ? ` (offset: ${offset})` : ''}`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${tableName}: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;
    
    console.log(`📊 Récupéré ${data.records.length} enregistrements de ${tableName} (total: ${allRecords.length})`);
    
  } while (offset);
  
  return allRecords;
}

serve(async (req) => {
  const rawBody = await req.clone().text();
  console.log('⏱️ import-airtable called at', new Date().toISOString());
  console.log('🗒️ Raw request body:', rawBody);

  // Lecture et validation des secrets dès le démarrage
  const AIRTABLE_PAT = Deno.env.get('AIRTABLE_PAT');
  const AIRTABLE_BASE_ID = Deno.env.get('AIRTABLE_BASE_ID');
  
  // Logs masqués pour debug (derniers 4 caractères)
  console.log('🔑 AIRTABLE_PAT présent:', AIRTABLE_PAT ? `***${AIRTABLE_PAT.slice(-4)}` : 'ABSENT');
  console.log('🔑 AIRTABLE_BASE_ID présent:', AIRTABLE_BASE_ID ? `***${AIRTABLE_BASE_ID.slice(-4)}` : 'ABSENT');

  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  if (req.method === 'POST') {
    try {
      console.log('Starting Airtable import...');
      
      let params: any = {};
      try {
        params = rawBody ? JSON.parse(rawBody) : {};
      } catch (e) {
        console.error('❌ import-airtable: invalid JSON', e);
        return new Response(JSON.stringify({ success: false, error: 'invalid_json' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Vérification des secrets requis avec messages d'erreur détaillés
      const errors = [];
      if (!AIRTABLE_PAT) errors.push('AIRTABLE_PAT manquant');
      if (!AIRTABLE_BASE_ID) errors.push('AIRTABLE_BASE_ID manquant');
      
      if (errors.length > 0) {
        console.error('❌ Secrets manquants:', errors);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'missing_secrets',
          details: errors 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const { 
        eventsTableName = 'All_Events',
        exposantsTableName = 'All_Exposants'
      } = params;

      console.log(`🔄 Import configuré avec Base ID: ${AIRTABLE_BASE_ID?.slice(-4)} et tables: ${eventsTableName}, ${exposantsTableName}`);

      let eventsImported = 0;
      let exposantsImported = 0;

      // Import events from Airtable
      console.log('🎯 Début import des événements...');
      const eventRecords = await fetchAllAirtableRecords(AIRTABLE_BASE_ID!, eventsTableName, AIRTABLE_PAT!);
      
      const eventsToInsert: any[] = [];
      // Créer un mapping des record IDs Airtable vers les IDs d'événements
      const airtableRecordToEventId = new Map<string, string>();
      
      for (const record of eventRecords) {
        const fields = record.fields;
        
        // Only process approved events
        if (fields['Status_Event']?.toLowerCase() !== 'approved') {
          console.log(`⚠️ Événement ${fields['ID_Event']} ignoré (statut: ${fields['Status_Event']})`);
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
          // Mapper le record ID Airtable vers l'ID d'événement
          airtableRecordToEventId.set(record.id, eventData.id);
        }
      }

      console.log(`📋 Préparé ${eventsToInsert.length} événements pour insertion`);
      console.log(`🗺️ Mapping créé : ${airtableRecordToEventId.size} correspondances record->event`);

      // Insert events into Supabase events_import table
      if (eventsToInsert.length > 0) {
        const { error: eventsError } = await supabaseClient
          .from('events_import')
          .upsert(eventsToInsert, { onConflict: 'id' });

        if (eventsError) {
          console.error('❌ Erreur insertion événements:', eventsError);
          throw new Error(`Failed to insert events: ${eventsError.message}`);
        }

        eventsImported = eventsToInsert.length;
        console.log(`✅ ${eventsImported} événements insérés avec succès`);

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

        const { error: prodError } = await supabaseClient
          .from('events')
          .upsert(productionEvents, { 
            onConflict: 'id_event',
            ignoreDuplicates: false 
          });

        if (prodError) {
          console.error('❌ Erreur promotion événements:', prodError);
          throw new Error(`Failed to upsert production events: ${prodError.message}`);
        }

        console.log(`✅ ${productionEvents.length} événements promus en production`);
      }

      // Import exposants from Airtable
      console.log('🏢 Début import des exposants...');
      const exposantRecords = await fetchAllAirtableRecords(AIRTABLE_BASE_ID!, exposantsTableName, AIRTABLE_PAT!);
      
      console.log(`📢 exposantRecords récupérés : ${exposantRecords.length}`);
      
      // Créer un Set des IDs d'événements approuvés pour la comparaison
      const approvedEventIds = new Set(eventsToInsert.map(ev => ev.id));
      console.log(`📦 approvedEventIds:`, Array.from(approvedEventIds));

      const exposantsToInsert: any[] = [];

      for (const record of exposantRecords) {
        const fields = record.fields;
        
        // Debug pour voir la structure des données
        console.log(`🔍 exposant fields:`, Object.keys(fields));
        console.log(`🔍 rec.fields.id_event:`, fields['id_event']);
        console.log(`🔍 rec.fields.ID_Event:`, fields['ID_Event']);
        
        // Le champ id_event est un tableau de record IDs Airtable
        const eventRecordIds = fields['id_event'] || [];
        console.log(`🔍 eventRecordIds reçus:`, eventRecordIds);
        
        // Vérifier si cet exposant est lié à un événement approuvé
        let isLinkedToApprovedEvent = false;
        for (const recordId of eventRecordIds) {
          const eventId = airtableRecordToEventId.get(recordId);
          console.log(`🔍 recordId ${recordId} -> eventId ${eventId}`);
          if (eventId && approvedEventIds.has(eventId)) {
            isLinkedToApprovedEvent = true;
            break;
          }
        }
        
        if (!isLinkedToApprovedEvent) {
          console.log(`⚠️ Exposant ${fields['nom_exposant']} ignoré (pas lié à un événement approuvé)`);
          continue;
        }

        if (!fields['nom_exposant']?.trim()) {
          console.log(`⚠️ Exposant ignoré (nom vide)`);
          continue;
        }

        // Utiliser le premier événement lié pour l'insertion
        const firstEventRecordId = eventRecordIds[0];
        const eventId = airtableRecordToEventId.get(firstEventRecordId);

        const exposantData = {
          id_event: eventId,
          nom_exposant: fields['nom_exposant'].trim(),
          id_exposant: fields['exposant_stand']?.trim() || '',
          website_exposant: fields['exposant_website']?.trim() || '',
          exposant_description: fields['exposant_description']?.trim() || ''
        };

        exposantsToInsert.push(exposantData);
        console.log(`✅ Exposant ${exposantData.nom_exposant} ajouté pour l'événement ${eventId}`);
      }

      console.log(`📋 Préparé ${exposantsToInsert.length} exposants pour insertion`);

      if (exposantsToInsert.length > 0) {
        const { error: exposantsError } = await supabaseClient
          .from('exposants')
          .insert(exposantsToInsert);

        if (exposantsError) {
          console.error('❌ Erreur insertion exposants:', exposantsError);
          throw new Error(`Failed to insert exposants: ${exposantsError.message}`);
        }
        
        exposantsImported = exposantsToInsert.length;
        console.log(`✅ ${exposantsImported} exposants insérés avec succès`);
      }

      // Summary response
      const summary = {
        success: true,
        eventsImported,
        exposantsImported,
        message: `Import terminé : ${eventsImported} événements et ${exposantsImported} exposants importés`
      };

      console.log('✅ Import Airtable terminé:', summary);

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('❌ Error in import-airtable function:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
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
