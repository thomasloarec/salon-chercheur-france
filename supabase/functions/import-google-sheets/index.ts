
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

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
  const [ , d, mth, y ] = m;
  // 2-digit year → 20xx
  const year = y.length === 2 ? `20${y}` : y.padStart(4,'0');
  const month = mth.padStart(2,'0');
  const day   = d.padStart(2,'0');
  return `${year}-${month}-${day}`;
}

// Supprime les accents et met en minuscule
function slugify(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // retire accents
    .toLowerCase();
}

// Mapping vers les valeurs autorisées par la contrainte CHECK
const EVENT_TYPE_ALLOWED = ['salon','conference','congres','convention','ceremonie'];

function normalizeEventType(raw: string | null): string {
  if (!raw) return 'salon';            // fallback
  const slug = slugify(raw.trim());
  if (EVENT_TYPE_ALLOWED.includes(slug)) return slug as typeof EVENT_TYPE_ALLOWED[number];
  // valeur inconnue -> fallback
  return 'salon';
}

interface EventData {
  ID_Event: string;
  nom_event: string;
  status_event: string;
  ai_certainty: string;
  type_event: string;
  date_debut: string;
  date_fin: string;
  date_complete: string;
  secteur: string;
  url_image: string;
  url_site_officiel: string;
  description_event: string;
  affluence: string;
  tarifs: string;
  nom_lieu: string;
  adresse: string;
  chatgpt_prompt: string;
}

interface ExposantData {
  ID_Event: string;
  exposant_nom: string;
  exposant_stand: string;
  exposant_website: string;
  exposant_description: string;
}

// Helper : convertir PEM (PKCS#8) en ArrayBuffer
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr.buffer;
}

// Function to get access token using service account
async function getAccessToken(): Promise<string> {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not found');
  }

  const keyData = JSON.parse(serviceAccountKey);
  
  // Importer la clé privée comme CryptoKey
  const keyDer = pemToArrayBuffer(keyData.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Préparer et signer le JWT
  const header = { alg: 'RS256', typ: 'JWT' } as const;
  const payload = {
    iss: keyData.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: getNumericDate(60 * 60),
    iat: getNumericDate(0),
  };

  const assertion = await create(header, payload, cryptoKey);

  // Échanger l'assertion contre un access_token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const url = new URL(req.url);
  
  // Handle GET request for listing Google Sheets
  if (req.method === 'GET' && url.pathname.includes('list-google-sheets')) {
    try {
      console.log('Listing Google Sheets...');
      const accessToken = await getAccessToken();
      
      const sheetsResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application/vnd.google-apps.spreadsheet%27&pageSize=100&fields=files(id,name)',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!sheetsResponse.ok) {
        throw new Error(`Failed to fetch sheets: ${sheetsResponse.statusText}`);
      }

      const sheetsData = await sheetsResponse.json();
      
      return new Response(JSON.stringify({ files: sheetsData.files }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error listing Google Sheets:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Handle POST request for importing data
  if (req.method === 'POST') {
    try {
      console.log('Starting Google Sheets import...');
      
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { spreadsheetId1, spreadsheetId2, sheetName1 = 'All_Evenements', sheetName2 = 'E46' } = await req.json();
      
      if (!spreadsheetId1 && !spreadsheetId2) {
        throw new Error('Au moins un ID de spreadsheet est requis');
      }

      // Get access token using service account
      const accessToken = await getAccessToken();

    console.log(`Importing from spreadsheets: ${spreadsheetId1 || 'none'} and ${spreadsheetId2 || 'none'}`);

    let eventsToInsert: any[] = [];
    let exposantsInserted = 0;
    const approvedIds = new Set<string>();

    // Import events from All_Evenements sheet (if provided)
    if (spreadsheetId1) {
      console.log('Fetching events data...');
      const eventsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId1}/values/${sheetName1}`;
      const eventsResponse = await fetch(eventsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch events data: ${eventsResponse.statusText} (${eventsResponse.status})`);
      }

      const eventsData = await eventsResponse.json();
      const eventsRows = eventsData.values;

      if (!eventsRows || eventsRows.length < 2) {
        console.log('No events data found or invalid format, skipping events import');
      } else {
        // Get headers and map data
        const eventsHeaders = eventsRows[0];
        console.log('📋 Headers found:', eventsHeaders);

        for (let i = 1; i < eventsRows.length; i++) {
          const row = eventsRows[i];
          
          // Vérifier si l'événement est approuvé
          const statusRaw = row[eventsHeaders.indexOf('Status_Event')] || '';
          const isApproved = statusRaw.trim().toLowerCase() === 'approved';
          if (!isApproved) continue; // on ignore la ligne
          
          // 🛂 DIAGNOSTIC: Mapping explicite des colonnes d'adresse
          const address = row[eventsHeaders.indexOf('Rue')] || '';
          const postal_code = row[eventsHeaders.indexOf('Code Postal')] || '';
          const city = row[eventsHeaders.indexOf('Ville')] || '';
          
          console.log('🛂 mapping sample', { 
            address: address, 
            postal_code: postal_code, 
            city: city,
            raw_row_sample: {
              rue_index: eventsHeaders.indexOf('Rue'),
              postal_index: eventsHeaders.indexOf('Code Postal'), 
              ville_index: eventsHeaders.indexOf('Ville'),
              rue_value: row[eventsHeaders.indexOf('Rue')],
              postal_value: row[eventsHeaders.indexOf('Code Postal')],
              ville_value: row[eventsHeaders.indexOf('Ville')]
            }
          });
          
          const eventData: any = {
            id: row[eventsHeaders.indexOf('ID_Event')] || '',
            nom_event: row[eventsHeaders.indexOf('Nom_Event')] || '',
            status_event: row[eventsHeaders.indexOf('Status_Event')] || '',
            ai_certainty: row[eventsHeaders.indexOf('AI_certainty')] || '',
            type_event: normalizeEventType(row[eventsHeaders.indexOf('Type_Event')] || ''),
            date_debut: normalizeDate(row[eventsHeaders.indexOf('Date_debut')] || ''),
            date_fin: normalizeDate(row[eventsHeaders.indexOf('Date_Fin')] || ''),
            date_complete: row[eventsHeaders.indexOf('Date_complète')] || '',
            secteur: row[eventsHeaders.indexOf('Secteur')] || '',
            url_image: row[eventsHeaders.indexOf('URL_image')] || '',
            url_site_officiel: row[eventsHeaders.indexOf('URL_site_officiel')] || '',
            description_event: row[eventsHeaders.indexOf('Description_Event')] || '',
            affluence: row[eventsHeaders.indexOf('Affluence')] || '',
            tarifs: row[eventsHeaders.indexOf('Tarifs')] || '',
            nom_lieu: row[eventsHeaders.indexOf('Nom_Lieu')] || '',
            rue: address,                    // 🛂 EXPLICIT mapping
            postal_code: postal_code,        // 🛂 EXPLICIT mapping  
            ville: city,                     // 🛂 EXPLICIT mapping
            chatgpt_prompt: row[eventsHeaders.indexOf('ChatGPT_Prompt')] || ''
          };

          if (eventData.id) {
            eventsToInsert.push(eventData);
            approvedIds.add(eventData.id);
          }
        }

        console.log(`Events ignorés (non Approved) : ${eventsRows.length - 1 - eventsToInsert.length}`);

        console.log(`Prepared ${eventsToInsert.length} events for insertion`);

        // Dédupliquer eventsToInsert par id
        const originalLength = eventsToInsert.length;
        const uniqueEventsMap: Record<string, any> = {};
        eventsToInsert.forEach(ev => {
          uniqueEventsMap[ev.id] = ev;
        });
        eventsToInsert = Object.values(uniqueEventsMap);
        
        console.log(`Deduplicated events: from ${originalLength} to ${eventsToInsert.length}`);

        // Insert events into Supabase
        if (eventsToInsert.length > 0) {
          const { error: eventsError } = await supabaseClient
            .from('events_import')
            .upsert(eventsToInsert, { onConflict: 'id' });

          if (eventsError) {
            console.error('Error inserting events:', eventsError);
            throw new Error(`Failed to insert events: ${eventsError.message}`);
          }
          console.log(`Successfully inserted ${eventsToInsert.length} events`);

          // ------- DUPLICATION DANS LA TABLE DE PRODUCTION -------
          // Construction des événements avec gestion des colonnes NOT NULL
          const productionEvents = eventsToInsert.map(ev => {
            // 🛂 DIAGNOSTIC: Log avant insertion en production
            console.log('🏭 Production mapping sample', {
              event_id: ev.id,
              address: ev.rue || null,
              postal_code: ev.postal_code || null, 
              city: ev.ville || 'Inconnue'
            });
            
            return {
              id_event: ev.id,                                  // texte
              name: ev.nom_event || 'Sans titre',
              visible: (ev.status_event ?? '').toLowerCase() === 'active',
              event_type: ev.type_event || 'salon',
              start_date: ev.date_debut || '1970-01-01',
              end_date: ev.date_fin || ev.date_debut || '1970-01-01',
              sector: ev.secteur || 'Autre',
              location: ev.nom_lieu || 'Non précisé',
              address: ev.rue || null,                          // Rue → address
              postal_code: ev.postal_code || null,              // Code Postal → postal_code
              city: ev.ville || 'Inconnue',                     // Ville → city
              image_url: ev.url_image || null,
              website_url: ev.url_site_officiel || null,
              description: ev.description_event || null,
              estimated_visitors: ev.affluence && ev.affluence.trim() !== '' ? Number(ev.affluence) : null,
              entry_fee: ev.tarifs || null,
              venue_name: ev.nom_lieu || null,
              // Supabase générera created_at / updated_at
            };
          });

          const { error: prodError } = await supabaseClient
            .from('events')
            .upsert(productionEvents, { onConflict: 'id_event' });

          if (prodError) {
            console.error('Error upserting production events:', prodError);
            throw new Error(`Failed to upsert production events: ${prodError.message}`);
          }
          console.log(`Successfully duplicated ${productionEvents.length} events to production table`);
          console.log(`Inserted/updated ${productionEvents.length} events & ${exposantsInserted} exposants`);
          // ------------------------------------------------------
        }
      }
    }

    // Import exposants from selected sheet (if provided)
    if (spreadsheetId2) {
      console.log(`Fetching exposants data from sheet: ${sheetName2}...`);
      const exposantsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId2}/values/${sheetName2}`;
      const exposantsResponse = await fetch(exposantsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!exposantsResponse.ok) {
        throw new Error(`Failed to fetch exposants data: ${exposantsResponse.statusText} (${exposantsResponse.status})`);
      }

      const exposantsData = await exposantsResponse.json();
      const exposantsRows = exposantsData.values;

      if (!exposantsRows || exposantsRows.length < 2) {
        console.log('No exposants data found, skipping exposants import');
      } else {
        // Get headers and map data
        const exposantsHeaders = exposantsRows[0];
        const exposantsToInsert: any[] = [];

        for (let i = 1; i < exposantsRows.length; i++) {
          const row = exposantsRows[i];
          const exposantData: any = {
            id_event: row[exposantsHeaders.indexOf('ID_Event')] || '',
            exposant_nom: row[exposantsHeaders.indexOf('exposant_nom')] || '',
            exposant_stand: row[exposantsHeaders.indexOf('exposant_stand')] || '',
            exposant_website: row[exposantsHeaders.indexOf('exposant_website')] || '',
            exposant_description: row[exposantsHeaders.indexOf('exposant_description')] || ''
          };

          // Ne prendre que les exposants d'un événement Approved
          if (!approvedIds.has(exposantData.id_event)) continue;

          if (exposantData.id_event && exposantData.exposant_nom) {
            exposantsToInsert.push(exposantData);
          }
        }

        console.log(`Prepared ${exposantsToInsert.length} exposants for insertion`);

        // Insert exposants into Supabase
        if (exposantsToInsert.length > 0) {
          const { error: exposantsError } = await supabaseClient
            .from('exposants')
            .insert(exposantsToInsert);

          if (exposantsError) {
            console.error('Error inserting exposants:', exposantsError);
            throw new Error(`Failed to insert exposants: ${exposantsError.message}`);
          }
          console.log(`Successfully inserted ${exposantsToInsert.length} exposants`);
          exposantsInserted = exposantsToInsert.length;
        }
      }
    }

    // Return summary
    const summary = {
      success: true,
      eventsImported: eventsToInsert.length,
      exposantsImported: exposantsInserted,
      message: 'Import completed successfully'
    };

    console.log('Import completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    } catch (error) {
      console.error('Error in import-google-sheets function:', error);
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

  // If neither GET nor POST, return method not allowed
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
