import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ToggleRouteRequest {
  event_id: string
  novelty_id: string
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

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { event_id, novelty_id }: ToggleRouteRequest = await req.json()

    if (!event_id || !novelty_id) {
      return new Response(
        JSON.stringify({ error: 'event_id and novelty_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create user route for this event
    let { data: userRoute, error: routeError } = await supabase
      .from('user_routes')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', event_id)
      .single()

    if (routeError && routeError.code === 'PGRST116') {
      // Route doesn't exist, create it
      const { data: newRoute, error: createError } = await supabase
        .from('user_routes')
        .insert({ user_id: user.id, event_id })
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating user route:', createError)
        return new Response(
          JSON.stringify({ error: 'Failed to create user route' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userRoute = newRoute
    } else if (routeError) {
      console.error('Error fetching user route:', routeError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user route' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if novelty is already in route
    const { data: existingItem } = await supabase
      .from('route_items')
      .select('id')
      .eq('route_id', userRoute?.id)
      .eq('novelty_id', novelty_id)
      .single()

    let added = false

    if (existingItem) {
      // Remove from route
      const { error: deleteError } = await supabase
        .from('route_items')
        .delete()
        .eq('id', existingItem.id)

      if (deleteError) {
        console.error('Error removing from route:', deleteError)
        return new Response(
          JSON.stringify({ error: 'Failed to remove from route' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      added = false
    } else {
      // Add to route
      const { error: insertError } = await supabase
        .from('route_items')
        .insert({ route_id: userRoute?.id, novelty_id })

      if (insertError) {
        console.error('Error adding to route:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to add to route' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      added = true
    }

    // Get updated stats
    const { data: stats } = await supabase
      .from('novelty_stats')
      .select('route_users_count')
      .eq('novelty_id', novelty_id)
      .single()

    return new Response(
      JSON.stringify({
        added,
        route_users_count: stats?.route_users_count || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Route toggle error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})