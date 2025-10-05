import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NoveltiesQuery {
  event_id?: string
  sort?: 'awaited' | 'recent'
  page?: string
  pageSize?: string
  sector?: string
  type?: string
  month?: string
  region?: string
  top?: boolean
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
        }
      }
    )

    const url = new URL(req.url)
    const params: NoveltiesQuery = Object.fromEntries(url.searchParams.entries())
    
    const page = parseInt(params.page || '1')
    const pageSize = Math.min(parseInt(params.pageSize || '10'), 50)
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('novelties')
      .select(`
        *,
        exhibitors!inner(id, name, slug, logo_url),
        novelty_stats!left(route_users_count, popularity_score),
        events!inner(id, nom_event, slug, ville, secteur, type_event, date_debut)
      `)
      .eq('status', 'Published')

    // Event-specific query
    if (params.event_id) {
      query = query.eq('event_id', params.event_id)
    }

    // Filters for global novelties page
    if (params.sector) {
      query = query.contains('events.secteur', [params.sector])
    }

    if (params.type) {
      query = query.eq('events.type_event', params.type)
    }

    if (params.month) {
      const month = parseInt(params.month)
      query = query.gte('events.date_debut', `${new Date().getFullYear()}-${month.toString().padStart(2, '0')}-01`)
               .lt('events.date_debut', `${new Date().getFullYear()}-${(month + 1).toString().padStart(2, '0')}-01`)
    }

    if (params.region) {
      // This would need proper region mapping logic based on your events geo data
      query = query.ilike('events.ville', `%${params.region}%`)
    }

    // Top novelties (one per event) - Always group by event unless on event-specific page
    if (!params.event_id) {
      // Fetch ALL published novelties with their stats and event info
      const { data: allNovelties, error: allError } = await supabase
        .from('novelties')
        .select(`
          *,
          exhibitors!inner(id, name, slug, logo_url),
          novelty_stats!left(route_users_count, popularity_score),
          events!inner(id, nom_event, slug, ville, secteur, type_event, date_debut)
        `)
        .eq('status', 'Published')
        .eq('events.visible', true)
        .gte('events.date_debut', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false });

      if (allError) {
        console.error('Error fetching novelties:', allError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch novelties' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Group by event_id and keep only the most popular one per event
      const topNoveltiesMap = new Map();
      (allNovelties || []).forEach(novelty => {
        const eventId = novelty.event_id;
        const existingNovelty = topNoveltiesMap.get(eventId);
        
        if (!existingNovelty) {
          topNoveltiesMap.set(eventId, novelty);
        } else {
          // Compare popularity: route_users_count first, then created_at
          const currentScore = novelty.novelty_stats?.route_users_count || 0;
          const existingScore = existingNovelty.novelty_stats?.route_users_count || 0;
          
          if (currentScore > existingScore) {
            topNoveltiesMap.set(eventId, novelty);
          } else if (currentScore === existingScore && novelty.created_at > existingNovelty.created_at) {
            topNoveltiesMap.set(eventId, novelty);
          }
        }
      });

      const topNovelties = Array.from(topNoveltiesMap.values())
        .sort((a, b) => {
          const scoreA = a.novelty_stats?.route_users_count || 0;
          const scoreB = b.novelty_stats?.route_users_count || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      return new Response(
        JSON.stringify({
          data: topNovelties,
          total: topNovelties.length,
          page,
          pageSize
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply sorting
    if (params.sort === 'recent') {
      query = query.order('created_at', { ascending: false })
    } else {
      // Default to 'awaited' - sort by popularity
      query = query.order('novelty_stats.popularity_score', { ascending: false, nullsFirst: false })
               .order('created_at', { ascending: false })
    }

    // Apply pagination and get count
    const { data: novelties, error, count } = await query
      .range(offset, offset + pageSize - 1)
      .select('*', { count: 'exact' })

    if (error) {
      console.error('Error fetching novelties:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch novelties' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has any of these novelties in their route
    const { data: { user } } = await supabase.auth.getUser()
    let userRouteItems: string[] = []
    
    if (user && novelties?.length) {
      const noveltyIds = novelties.map(n => n.id)
      const { data: routeItems } = await supabase
        .from('route_items')
        .select('novelty_id, user_routes!inner(user_id)')
        .eq('user_routes.user_id', user.id)
        .in('novelty_id', noveltyIds)

      userRouteItems = routeItems?.map(item => item.novelty_id) || []
    }

    // Add user route status to novelties
    const noveltiesWithRouteStatus = novelties?.map(novelty => ({
      ...novelty,
      in_user_route: userRouteItems.includes(novelty.id)
    }))

    return new Response(
      JSON.stringify({
        data: noveltiesWithRouteStatus || [],
        total: count || 0,
        page,
        pageSize
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('List novelties error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})