
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://deno.land/x/supabase@1.0.0/mod.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

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

    console.log('Starting newsletter sending process...');

    // Récupérer toutes les inscriptions à la newsletter
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('newsletter_subscriptions')
      .select('*');

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError);
      throw subscriptionsError;
    }

    console.log(`Found ${subscriptions?.length || 0} newsletter subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions found' }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Calculer les dates pour les filtres
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthAfterNext = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const lastMonthCronDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    console.log('Date filters:', {
      nextMonthStart: nextMonth.toISOString(),
      monthAfterNextStart: monthAfterNext.toISOString(),
      lastMonthCronDate: lastMonthCronDate.toISOString(),
      currentDate: now.toISOString()
    });

    // Récupérer tous les secteurs pour les noms
    const { data: sectors, error: sectorsError } = await supabase
      .from('sectors')
      .select('id, name');

    if (sectorsError) {
      console.error('Error fetching sectors:', sectorsError);
      throw sectorsError;
    }

    const sectorMap = new Map(sectors?.map(s => [s.id, s.name]) || []);

    let emailsSent = 0;
    let errors = 0;

    // Traiter chaque abonnement
    for (const subscription of subscriptions) {
      try {
        console.log(`Processing subscription for ${subscription.email}...`);

        // Récupérer les événements du mois prochain
        const { data: nextMonthEvents, error: nextMonthError } = await supabase
          .from('events')
          .select('*')
          .gte('date_debut', nextMonth.toISOString().split('T')[0])
          .lt('date_debut', monthAfterNext.toISOString().split('T')[0])
          .in('sector', subscription.sectors.map(id => sectorMap.get(id)).filter(Boolean));

        if (nextMonthError) {
          console.error('Error fetching next month events:', nextMonthError);
          continue;
        }

        // Récupérer les nouveaux événements futurs
        const { data: newFutureEvents, error: newFutureError } = await supabase
          .from('events')
          .select('*')
          .gte('created_at', lastMonthCronDate.toISOString())
          .lt('created_at', now.toISOString())
          .gte('date_debut', monthAfterNext.toISOString().split('T')[0])
          .in('sector', subscription.sectors.map(id => sectorMap.get(id)).filter(Boolean));

        if (newFutureError) {
          console.error('Error fetching new future events:', newFutureError);
          continue;
        }

        const nextMonthEventsData = nextMonthEvents || [];
        const newFutureEventsData = newFutureEvents || [];

        console.log(`Found ${nextMonthEventsData.length} next month events and ${newFutureEventsData.length} new future events`);

        // Si aucun événement, passer au suivant
        if (nextMonthEventsData.length === 0 && newFutureEventsData.length === 0) {
          console.log(`No events found for ${subscription.email}, skipping...`);
          continue;
        }

        // Construire l'email HTML
        const sectorNames = subscription.sectors
          .map(id => sectorMap.get(id))
          .filter(Boolean)
          .join(', ');

        const nextMonthName = nextMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        const emailHtml = generateEmailHtml({
          sectorNames,
          nextMonthName,
          nextMonthEvents: nextMonthEventsData,
          newFutureEvents: newFutureEventsData
        });

        // TODO: Intégrer ici l'envoi d'email via Resend ou autre provider
        // Pour l'instant, on log juste le contenu
        console.log(`Email generated for ${subscription.email}:`, {
          subject: `Vos salons ${sectorNames} – ${nextMonthName}`,
          htmlLength: emailHtml.length
        });

        emailsSent++;
      } catch (error) {
        console.error(`Error processing subscription for ${subscription.email}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Newsletter process completed. Emails sent: ${emailsSent}, Errors: ${errors}`,
        emailsSent,
        errors
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error in send-newsletters function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

function generateEmailHtml({ sectorNames, nextMonthName, nextMonthEvents, newFutureEvents }: {
  sectorNames: string;
  nextMonthName: string;
  nextMonthEvents: any[];
  newFutureEvents: any[];
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const eventToHtml = (event: any) => {
    return `
      <div style="margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px;">${event.name}</h3>
        <p style="margin: 4px 0; color: #6b7280;">
          📅 ${formatDate(event.date_debut)}${event.date_fin !== event.date_debut ? ` - ${formatDate(event.date_fin)}` : ''}
        </p>
        <p style="margin: 4px 0; color: #6b7280;">📍 ${event.city}${event.venue_name ? ` - ${event.venue_name}` : ''}</p>
        ${event.description ? `<p style="margin: 8px 0 0 0; color: #4b5563; font-size: 14px;">${event.description.substring(0, 200)}${event.description.length > 200 ? '...' : ''}</p>` : ''}
      </div>
    `;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vos salons ${sectorNames} – ${nextMonthName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1f2937; margin-bottom: 10px;">SalonsPro</h1>
        <h2 style="color: #6366f1; margin: 0;">Vos salons ${sectorNames} – ${nextMonthName}</h2>
      </div>

      ${nextMonthEvents.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">📅 À l'agenda le mois prochain</h2>
          ${nextMonthEvents.map(eventToHtml).join('')}
        </div>
      ` : ''}

      ${newFutureEvents.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #1f2937; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">🆕 Tout juste annoncés</h2>
          ${newFutureEvents.map(eventToHtml).join('')}
        </div>
      ` : ''}

      <div style="margin-top: 40px; padding: 20px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          Vous recevez cet email car vous êtes abonné à la newsletter SalonsPro.
          <br>
          <a href="#" style="color: #6366f1;">Se désabonner</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

serve(handler);
