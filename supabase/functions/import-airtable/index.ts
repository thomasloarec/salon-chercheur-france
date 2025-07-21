
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
  const slug = raw.toLowerCase().trim();
  if (EVENT_TYPE_ALLOWED.includes(slug)) return slug as typeof EVENT_TYPE_ALLOWED[number];
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

serve(async (req) => {
  const rawBody = await req.clone().text();
  console.log('⏱️ import-airtable called at', new Date().toISOString());
  console.log('🗒️ Raw request body:', rawBody);

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

      const { 
        apiKey, 
        baseId, 
        eventsTableName = 'Events',
        exposantsTableName = 'Exposants'
      } = params;
      
      if (!apiKey || !baseId) {
        throw new Error('API Key et Base ID sont requis');
      }

      console.log(`Importing from Airtable base: ${baseId}`);

      let eventsToInsert: any[] = [];
      let exposantsInserted = 0;

      // TODO: Uncomment these lines when ready to activate Airtable import
      /*
      // Import events from Airtable
      const eventsUrl = `https://api.airtable.com/v0/${baseId}/${eventsTableName}`;
      const eventsResponse = await fetch(eventsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch events: ${eventsResponse.statusText}`);
      }

      const eventsData = await eventsResponse.json();
      const eventRecords: AirtableEventRecord[] = eventsData.records;

      for (const record of eventRecords) {
        const fields = record.fields;
        
        // Only process approved events
        if (fields['Status_Event']?.toLowerCase() !== 'approved') {
          continue;
        }

        const eventData = {
          id: fields['ID_Event'],
          name_event: fields['Nom_Event'] || '',
          type_event: normalizeEventType(fields['Type_Event']),
          date_debut: normalizeDate(fields['Date_debut']),
          date_fin: normalizeDate(fields['Date_Fin']),
          secteur: fields['Secteur'] || '',
          url_image: fields['URL_image'] || null,
          url_site_officiel: fields['URL_site_officiel'] || null,
          description_event: fields['Description_Event'] || null,
          affluence: fields['Affluence'] && fields['Affluence'].trim() !== '' ? Number(fields['Affluence']) : null,
          tarif: fields['Tarifs'] || null,
          nom_lieu: fields['Nom_Lieu'] || null,
          rue: fields['Rue'] || null,
          code_postal: fields['Code_Postal'] || null,
          ville: fields['Ville'] || 'Inconnue'
        };

        if (eventData.id) {
          eventsToInsert.push(eventData);
        }
      }

      console.log(`Prepared ${eventsToInsert.length} events for insertion`);

      // Insert events into Supabase events_import table
      if (eventsToInsert.length > 0) {
        const { error: eventsError } = await supabaseClient
          .from('events_import')
          .upsert(eventsToInsert, { onConflict: 'id' });

        if (eventsError) {
          throw new Error(`Failed to insert events: ${eventsError.message}`);
        }

        // Promote to production events table
        const productionEvents = eventsToInsert.map(ev => ({
          id_event: ev.id,
          name_event: ev.name_event,
          visible: false, // Default invisible
          type_event: ev.type_event,
          date_debut: ev.date_debut || '1970-01-01',
          date_fin: ev.date_fin || ev.date_debut || '1970-01-01',
          secteur: ev.secteur || 'Autre',
          ville: ev.ville,
          rue: ev.rue,
          code_postal: ev.code_postal,
          country: 'France',
          url_image: ev.url_image,
          url_site_officiel: ev.url_site_officiel,
          description_event: ev.description_event,
          affluence: ev.affluence,
          tarif: ev.tarif,
          nom_lieu: ev.nom_lieu,
        }));

        const { error: prodError } = await supabaseClient
          .from('events')
          .upsert(productionEvents, { 
            onConflict: 'id_event',
            ignoreDuplicates: false 
          });

        if (prodError) {
          throw new Error(`Failed to upsert production events: ${prodError.message}`);
        }

        console.log(`Successfully promoted ${productionEvents.length} events to production`);
      }

      // Import exposants from Airtable
      const exposantsUrl = `https://api.airtable.com/v0/${baseId}/${exposantsTableName}`;
      const exposantsResponse = await fetch(exposantsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!exposantsResponse.ok) {
        throw new Error(`Failed to fetch exposants: ${exposantsResponse.statusText}`);
      }

      const exposantsData = await exposantsResponse.json();
      const exposantRecords: AirtableExposantRecord[] = exposantsData.records;

      const approvedEventIds = new Set(eventsToInsert.map(ev => ev.id));
      const exposantsToInsert: any[] = [];

      for (const record of exposantRecords) {
        const fields = record.fields;
        
        // Only include exposants for approved events
        if (!approvedEventIds.has(fields['ID_Event'])) {
          continue;
        }

        if (!fields['exposant_nom']?.trim()) {
          continue;
        }

        const exposantData = {
          id_event: fields['ID_Event'],
          exposant_nom: fields['exposant_nom'].trim(),
          exposant_stand: fields['exposant_stand']?.trim() || '',
          exposant_website: fields['exposant_website']?.trim() || '',
          exposant_description: fields['exposant_description']?.trim() || ''
        };

        exposantsToInsert.push(exposantData);
      }

      if (exposantsToInsert.length > 0) {
        const { error: exposantsError } = await supabaseClient
          .from('exposants')
          .insert(exposantsToInsert);

        if (exposantsError) {
          throw new Error(`Failed to insert exposants: ${exposantsError.message}`);
        }
        
        exposantsInserted = exposantsToInsert.length;
        console.log(`Successfully inserted ${exposantsInserted} exposants`);
      }
      */

      // For now, return a placeholder response
      const summary = {
        success: true,
        eventsImported: 0, // Will be eventsToInsert.length when activated
        exposantsImported: 0, // Will be exposantsInserted when activated
        message: 'Airtable import function created - TODO: Activate API calls when ready'
      };

      console.log('Airtable import function ready:', summary);

      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error in import-airtable function:', error);
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
