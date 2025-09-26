import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DbExhibitor {
  id: string;
  name: string;
  website?: string;
  logo_url?: string;
  approved: boolean;
  stand_info?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    )

    const { event_slug, search } = await req.json()

    if (!event_slug) {
      return new Response(
        JSON.stringify({ 
          exhibitors: [], 
          total: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // First, get the event's id_event (Event_XX) from slug
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id_event')
      .eq('slug', event_slug)
      .single()

    if (eventError || !eventData?.id_event) {
      return new Response(
        JSON.stringify({ 
          exhibitors: [], 
          total: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get exhibitors from participations_with_exhibitors view using id_event_text
    const { data: participations, error } = await supabase
      .from('participations_with_exhibitors')
      .select('*')
      .eq('id_event_text', eventData.id_event)

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ 
          exhibitors: [], 
          total: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map to expected format
    let exhibitors = (participations || []).map(p => ({
      id: p.id_exposant || String(p.exhibitor_uuid || ''),
      name: p.exhibitor_name || p.id_exposant || '',
      slug: p.id_exposant || String(p.exhibitor_uuid || ''),
      logo_url: null,
      stand: p.stand_exposant || null,
      hall: null,
      plan: 'free' as const,
      website: p.exhibitor_website || p.website_exposant || null
    })).filter(e => e.name)

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      exhibitors = exhibitors.filter(exhibitor => 
        exhibitor.name.toLowerCase().includes(searchLower) ||
        (exhibitor.website && exhibitor.website.toLowerCase().includes(searchLower))
      )
    }

    // Sort alphabetically
    exhibitors.sort((a, b) => a.name.localeCompare(b.name))

    return new Response(
      JSON.stringify({ 
        exhibitors,
        total: exhibitors.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        exhibitors: [], 
        total: 0 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})