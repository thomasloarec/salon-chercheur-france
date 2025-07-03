
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://deno.land/x/supabase@1.0.0/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface SubscribeRequest {
  email: string;
  sectorIds: string[];
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

    // Vérifier si l'email existe déjà
    const { data: existingSubscription, error: selectError } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('email', email)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error checking existing subscription:', selectError);
      throw selectError;
    }

    let result;
    if (existingSubscription) {
      // Fusionner les secteurs existants avec les nouveaux
      const currentSectors = existingSubscription.sectors || [];
      const allSectors = [...new Set([...currentSectors, ...sectorIds])];

      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .update({ sectors: allSectors })
        .eq('email', email)
        .select();

      if (error) throw error;
      result = data;
      console.log('Updated existing subscription with new sectors');
    } else {
      // Créer un nouvel abonnement
      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .insert({ email, sectors: sectorIds })
        .select();

      if (error) throw error;
      result = data;
      console.log('Created new newsletter subscription');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Abonnement confirmé ! Vous recevrez votre première newsletter début du mois prochain.',
        data: result 
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
      errorMessage = 'Cette adresse email est déjà abonnée';
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
