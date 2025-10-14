import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, email, company, eventName, eventDate, eventSlug, eventId, noveltiesOpenDate } = await req.json();

    // Validation
    if (!firstName || !lastName || !email || !eventName || !eventDate) {
      return new Response(
        JSON.stringify({ error: 'Champs requis manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les credentials depuis les secrets Supabase
    const airtableToken = Deno.env.get('VITE_AIRTABLE_TOKEN');
    const airtableBaseId = Deno.env.get('VITE_AIRTABLE_BASE_ID');

    if (!airtableToken || !airtableBaseId) {
      console.error('Missing Airtable credentials');
      return new Response(
        JSON.stringify({ error: 'Configuration serveur manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const airtableTableName = 'Leads Nouveautés';

    // Préparer les données pour Airtable
    const airtableData = {
      fields: {
        'Prénom': firstName,
        'Nom': lastName,
        'Email': email,
        'Entreprise': company || '',
        'Nom Événement': eventName,
        'Date Événement': eventDate,
        'Slug Événement': eventSlug || '',
        'ID Événement': eventId,
        'Date Ouverture Nouveautés': noveltiesOpenDate,
        'Statut Notification': 'En attente',
        'Date Inscription': new Date().toISOString(),
        'Source': 'LotExpo - Page Événement',
      },
    };

    // Envoyer vers Airtable
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(airtableTableName)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${airtableToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(airtableData),
      }
    );

    if (!airtableResponse.ok) {
      const errorData = await airtableResponse.json();
      console.error('Airtable error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'envoi vers Airtable', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await airtableResponse.json();

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in novelty-notification-subscribe:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
