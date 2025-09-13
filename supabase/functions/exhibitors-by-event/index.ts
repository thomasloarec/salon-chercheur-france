import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EventExhibitor {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  stand: string | null;
  hall: string | null;
  plan: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const eventSlug = url.pathname.split('/').pop();
    const searchQuery = url.searchParams.get('q') || '';

    console.log('Fetching exhibitors for event:', eventSlug, 'search:', searchQuery);

    // First, get the event by slug
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, id_event')
      .eq('slug', eventSlug)
      .eq('visible', true)
      .single();

    if (eventError || !event) {
      console.error('Event not found:', eventSlug, eventError);
      return new Response(
        JSON.stringify({ error: 'Event not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Found event:', event.id_event);

    // Build the exhibitors query
    let exhibitorsQuery = supabase
      .from('participation')
      .select(`
        id_exposant,
        stand_exposant,
        exhibitors:id_exposant (
          id,
          name,
          slug,
          logo_url,
          plan
        )
      `)
      .eq('id_event', event.id);

    // Execute the query
    const { data: participations, error: participationsError } = await exhibitorsQuery;

    if (participationsError) {
      console.error('Error fetching participations:', participationsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch exhibitors' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Found participations:', participations?.length || 0);

    // Transform the data and apply search filter
    const exhibitors: EventExhibitor[] = (participations || [])
      .filter(p => p.exhibitors) // Only include valid exhibitors
      .map(p => ({
        id: p.exhibitors.id,
        name: p.exhibitors.name,
        slug: p.exhibitors.slug,
        logo_url: p.exhibitors.logo_url,
        stand: p.stand_exposant,
        hall: null, // We'll extract this from stand_exposant if needed
        plan: p.exhibitors.plan || 'free'
      }))
      .filter(exhibitor => {
        if (!searchQuery.trim()) return true;
        return exhibitor.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort A-Z

    console.log('Returning exhibitors:', exhibitors.length);

    return new Response(
      JSON.stringify({ 
        exhibitors,
        total: exhibitors.length,
        event_id: event.id,
        event_slug: eventSlug
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});