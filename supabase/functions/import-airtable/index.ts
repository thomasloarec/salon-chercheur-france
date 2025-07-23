
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

// Import functions
async function importEvents(supabaseClient: any, airtableConfig: { pat: string, baseId: string }) {
  console.log('Importing events...');
  const eventsResponse = await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/All_Events`, {
    headers: {
      'Authorization': `Bearer ${airtableConfig.pat}`,
      'Content-Type': 'application/json'
    }
  });

  if (!eventsResponse.ok) {
    throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
  }

  const eventsData = await eventsResponse.json();
  console.log('[DEBUG] Nombre d\'événements récupérés depuis Airtable :', eventsData.records?.length || 0);
  console.log('[DEBUG] Exemple de 5 événements :', eventsData.records?.slice(0,5) || []);
  const eventsToInsert: any[] = [];

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
  console.log('Importing exposants...');
  const exposantsResponse = await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/All_Exposants`, {
    headers: {
      'Authorization': `Bearer ${airtableConfig.pat}`,
      'Content-Type': 'application/json'
    }
  });

  if (!exposantsResponse.ok) {
    throw new Error(`Failed to fetch exposants: ${exposantsResponse.status}`);
  }

  const exposantsData = await exposantsResponse.json();
  console.log('[DEBUG] Nombre d\'exposants récupérés depuis Airtable :', exposantsData.records?.length || 0);
  console.log('[DEBUG] Exemple de 5 exposants :', exposantsData.records?.slice(0,5) || []);
  const exposantsToInsert: any[] = [];

  for (const record of exposantsData.records) {
    const fields = record.fields;
    console.log('[DEBUG] Clés exposant.fields :', Object.keys(record.fields));
    
    if (!fields['nom_exposant']?.trim()) {
      continue;
    }

    const exposantData = {
      id_event: fields['All_Events']?.[0] || '',
      nom_exposant: fields['nom_exposant'].trim(),
      id_exposant: fields['id_exposant']?.trim() || '',
      website_exposant: fields['website_exposant']?.trim() || '',
      exposant_description: fields['exposant_description']?.trim() || ''
    };

    if (exposantData.id_event && exposantData.nom_exposant) {
      exposantsToInsert.push(exposantData);
    }
  }

  let exposantsImported = 0;

  if (exposantsToInsert.length > 0) {
    console.log(`[DEBUG] Insertion de ${exposantsToInsert.length} enregistrements dans la table exposants`);
    const { data: exposantsData, error: exposantsError } = await supabaseClient
      .from('exposants')
      .insert(exposantsToInsert)
      .select();

    if (exposantsError) {
      console.error(`[ERROR] Échec insertion dans exposants :`, exposantsError);
      throw new Error(`Failed to insert exposants: ${exposantsError.message}`);
    } else {
      console.log(`[DEBUG] ${exposantsData?.length || 0} enregistrements insérés avec succès dans exposants`);
    }
    
    exposantsImported = exposantsToInsert.length;
    console.log(`Imported ${exposantsImported} exposants`);
  }

  return exposantsImported;
}

async function importParticipation(supabaseClient: any, airtableConfig: { pat: string, baseId: string }) {
  console.log('Importing participation...');
  const participationResponse = await fetch(`https://api.airtable.com/v0/${airtableConfig.baseId}/Participation`, {
    headers: {
      'Authorization': `Bearer ${airtableConfig.pat}`,
      'Content-Type': 'application/json'
    }
  });

  if (!participationResponse.ok) {
    throw new Error(`Failed to fetch participation: ${participationResponse.status}`);
  }

  const participationData = await participationResponse.json();
  console.log('[DEBUG] Nombre de participations récupérées depuis Airtable :', participationData.records?.length || 0);
  console.log('[DEBUG] Exemple de 5 participations :', participationData.records?.slice(0,5) || []);
  const participationToInsert: any[] = [];

  for (const record of participationData.records) {
    const fields = record.fields;
    console.log('[DEBUG] Clés participation.fields :', Object.keys(record.fields));
    
    if (!fields['id_exposant'] || !fields['id_event']) {
      continue;
    }

    const participationRecord = {
      id_exposant: fields['id_exposant'],
      id_event: fields['id_event'],
      stand_exposant: fields['stand_exposant']?.trim() || '',
      website_exposant: fields['website_exposant']?.trim() || '',
      urlexpo_event: fields['urlexpo_event']?.trim() || ''
    };

    participationToInsert.push(participationRecord);
  }

  let participationsImported = 0;

  if (participationToInsert.length > 0) {
    console.log(`[DEBUG] Insertion de ${participationToInsert.length} enregistrements dans la table participation`);
    const { data: participationData, error: participationError } = await supabaseClient
      .from('participation')
      .insert(participationToInsert)
      .select();

    if (participationError) {
      console.error(`[ERROR] Échec insertion dans participation :`, participationError);
      throw new Error(`Failed to insert participation: ${participationError.message}`);
    } else {
      console.log(`[DEBUG] ${participationData?.length || 0} enregistrements insérés avec succès dans participation`);
    }
    
    participationsImported = participationToInsert.length;
    console.log(`Imported ${participationsImported} participations`);
  }

  return participationsImported;
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

      // 3. Import des participations (toujours exécuté)
      const participationsImported = await importParticipation(supabaseClient, airtableConfig);
      console.log('[DEBUG] participationsImported =', participationsImported);

      // Summary response
      const summary = {
        success: true,
        eventsImported,
        exposantsImported,
        participationsImported,
        message: `Import completed: ${eventsImported} events, ${exposantsImported} exposants and ${participationsImported} participations imported`
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
