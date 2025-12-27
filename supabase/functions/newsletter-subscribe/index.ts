import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface SubscribeRequest {
  email: string;
  sectorIds: string[];
}

// Sync to Airtable Newsletter base
async function syncToAirtable(email: string, sectorNames: string[]): Promise<void> {
  const airtablePat = Deno.env.get('AIRTABLE_PAT');
  const baseId = Deno.env.get('AIRTABLE_NEWSLETTER_BASE_ID');
  
  if (!airtablePat || !baseId) {
    console.warn('Airtable Newsletter credentials not configured, skipping sync');
    return;
  }

  const tableName = 'Table 1';
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  // Airtable multi-select format: array of strings
  const record = {
    fields: {
      'Email': email,
      'Secteur': sectorNames
    }
  };

  console.log('Syncing to Airtable Newsletter:', { email, sectors: sectorNames });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${airtablePat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(record)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Airtable sync failed:', response.status, errorText);
    throw new Error(`Airtable sync failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('Airtable sync successful:', result.id);
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, sectorIds }: SubscribeRequest = await req.json();

    // Validation
    if (!email || !sectorIds || sectorIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Email et au moins un secteur sont requis' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Validation email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Format d\'email invalide' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('Newsletter subscription request:', { email, sectorIds });

    // Récupérer les noms des secteurs pour Airtable
    const { data: sectors } = await supabase
      .from('sectors')
      .select('id, name')
      .in('id', sectorIds);

    const sectorNames = sectors?.map(s => s.name) || [];
    console.log('Sector names resolved:', sectorNames);

    // 1. Sync to Airtable (source principale)
    try {
      await syncToAirtable(email, sectorNames);
    } catch (airtableError) {
      console.error('Airtable sync error (continuing with Supabase):', airtableError);
    }

    // 2. Also save to Supabase for backup/local queries
    const subscriptions = sectorIds.map(sectorId => ({
      email,
      sector_id: sectorId,
    }));

    const { data, error: upsertError } = await supabase
      .from('newsletter_subscriptions')
      .upsert(subscriptions, {
        onConflict: 'email,sector_id',
        ignoreDuplicates: true,
      })
      .select();

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
    } else {
      console.log(`Upserted ${sectorIds.length} sector subscriptions for ${email} in Supabase`);
    }

    // Récupérer tous les abonnements de l'utilisateur
    const { data: allSubscriptions } = await supabase
      .from('newsletter_subscriptions')
      .select('sector_id')
      .eq('email', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Abonnement confirmé ! Vous recevrez votre première newsletter début du mois prochain.',
        data: data,
        totalSubscriptions: allSubscriptions?.length || 0
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error in newsletter-subscribe function:', error);
    
    let errorMessage = 'Une erreur est survenue lors de l\'abonnement';
    if (error.code === '23505') {
      errorMessage = 'Vous êtes déjà abonné à ce secteur';
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);