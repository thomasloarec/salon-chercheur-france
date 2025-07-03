import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Function to get access token using service account
async function getAccessToken(): Promise<string> {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not found');
  }

  const keyData = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: keyData.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(keyData.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const jwt = await create({ alg: 'RS256', typ: 'JWT' }, payload, privateKey);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
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

        for (let i = 1; i < eventsRows.length; i++) {
          const row = eventsRows[i];
          const eventData: any = {
            id: row[eventsHeaders.indexOf('ID_Event')] || '',
            nom_event: row[eventsHeaders.indexOf('nom_event')] || '',
            status_event: row[eventsHeaders.indexOf('status_event')] || '',
            ai_certainty: row[eventsHeaders.indexOf('ai_certainty')] || '',
            type_event: row[eventsHeaders.indexOf('type_event')] || '',
            date_debut: row[eventsHeaders.indexOf('date_debut')] || '',
            date_fin: row[eventsHeaders.indexOf('date_fin')] || '',
            date_complete: row[eventsHeaders.indexOf('date_complete')] || '',
            secteur: row[eventsHeaders.indexOf('secteur')] || '',
            url_image: row[eventsHeaders.indexOf('url_image')] || '',
            url_site_officiel: row[eventsHeaders.indexOf('url_site_officiel')] || '',
            description_event: row[eventsHeaders.indexOf('description_event')] || '',
            affluence: row[eventsHeaders.indexOf('affluence')] || '',
            tarifs: row[eventsHeaders.indexOf('tarifs')] || '',
            nom_lieu: row[eventsHeaders.indexOf('nom_lieu')] || '',
            adresse: row[eventsHeaders.indexOf('adresse')] || '',
            chatgpt_prompt: row[eventsHeaders.indexOf('chatgpt_prompt')] || ''
          };

          if (eventData.id) {
            eventsToInsert.push(eventData);
          }
        }

        console.log(`Prepared ${eventsToInsert.length} events for insertion`);

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