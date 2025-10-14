import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventSlug: string;
  noveltiesOpenDate: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Novelty notification function called');

    // Récupérer les variables d'environnement (utiliser AIRTABLE_PAT qui existe déjà)
    const airtableToken = Deno.env.get('AIRTABLE_PAT') || Deno.env.get('AIRTABLE_TOKEN');
    const airtableBaseId = Deno.env.get('AIRTABLE_BASE_ID');

    console.log('📋 Checking env vars:', {
      hasToken: !!airtableToken,
      hasBaseId: !!airtableBaseId,
      tokenPreview: airtableToken ? `${airtableToken.substring(0, 10)}...` : 'MISSING',
      baseIdPreview: airtableBaseId ? `${airtableBaseId.substring(0, 10)}...` : 'MISSING',
      checkedVars: ['AIRTABLE_PAT', 'AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID']
    });

    if (!airtableToken || !airtableBaseId) {
      console.error('❌ Missing Airtable credentials');
      return new Response(
        JSON.stringify({
          error: 'Configuration error: Missing Airtable credentials',
          details: 'AIRTABLE_TOKEN or AIRTABLE_BASE_ID not set in Supabase Edge Function secrets'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parser le body
    const body: NotificationRequest = await req.json();
    console.log('📨 Request body received:', {
      email: body.email,
      eventName: body.eventName,
      hasAllFields: !!(body.firstName && body.lastName && body.email && body.eventId)
    });

    // Validation des champs requis
    if (!body.firstName || !body.lastName || !body.email || !body.eventId || !body.eventName || !body.eventDate) {
      console.error('❌ Missing required fields');
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['firstName', 'lastName', 'email', 'eventId', 'eventName', 'eventDate']
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Valider l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      console.error('❌ Invalid email format:', body.email);
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Préparer les données pour Airtable
    const airtableData = {
      fields: {
        'Prénom': body.firstName.trim(),
        'Nom': body.lastName.trim(),
        'Email': body.email.trim().toLowerCase(),
        'Entreprise': body.company?.trim() || '',
        'Nom Événement': body.eventName,
        'Date Événement': body.eventDate,
        'Slug Événement': body.eventSlug || '',
        'ID Événement': body.eventId,
        'Date Ouverture Nouveautés': body.noveltiesOpenDate,
        'Statut Notification': 'En attente',
        'Date Inscription': new Date().toISOString(),
        'Source': 'LotExpo - Page Événement',
      }
    };

    console.log('📤 Sending to Airtable:', {
      baseId: airtableBaseId,
      table: 'Leads Nouveautés',
      email: body.email
    });

    // Envoyer vers Airtable
    const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/Leads%20Nouveaut%C3%A9s`;
    console.log('🌐 Airtable URL:', airtableUrl);

    const airtableResponse = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(airtableData),
    });

    console.log('📡 Airtable response status:', airtableResponse.status);

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error('❌ Airtable error:', {
        status: airtableResponse.status,
        statusText: airtableResponse.statusText,
        body: errorText
      });
      
      return new Response(
        JSON.stringify({
          error: 'Failed to save to Airtable',
          details: errorText,
          status: airtableResponse.status
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const airtableResult = await airtableResponse.json();
    console.log('✅ Airtable success:', airtableResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification subscription registered',
        airtableId: airtableResult.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
