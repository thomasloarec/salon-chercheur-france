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

    const { event_id, slug, search } = await req.json()

    if (!event_id && !slug) {
      return new Response(
        JSON.stringify({ 
          items: [], 
          meta: { error: "missing_params", message: "event_id or slug required" },
          total: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get exhibitors participating in this event
    let query = supabase
      .from('participation')
      .select(`
        exhibitors!inner(
          id,
          name,
          website,
          logo_url,
          approved,
          stand_info
        )
      `)

    if (event_id) {
      query = query.eq('id_event', event_id);
    }

    const { data: participations, error } = await query

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ 
          items: [], 
          meta: { error: "database_error", message: "Failed to fetch exhibitors" },
          total: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract and filter exhibitors
    let exhibitors: DbExhibitor[] = (participations || [])
      .map(p => p.exhibitors)
      .filter(Boolean)

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
        items: exhibitors,
        meta: { error: null },
        total: exhibitors.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        items: [], 
        meta: { error: "internal_error", message: "Internal server error" },
        total: 0 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})