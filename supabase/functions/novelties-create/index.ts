import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateNoveltyRequest {
  event_id: string
  exhibitor_id: string
  title: string
  type: 'Launch' | 'Prototype' | 'MajorUpdate' | 'LiveDemo' | 'Partnership' | 'Offer' | 'Talk'
  reason_1?: string
  reason_2?: string
  reason_3?: string
  audience_tags?: string[]
  media_urls?: string[]
  doc_url?: string
  availability?: string
  stand_info?: string
  demo_slots?: any
}

function validateUrls(urls: string[]): string[] {
  return urls.filter(url => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  })
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

    const requestData: CreateNoveltyRequest = await req.json()

    // Validate required fields
    const { event_id, exhibitor_id, title, type } = requestData
    if (!event_id || !exhibitor_id || !title || !type) {
      return new Response(
        JSON.stringify({ error: 'event_id, exhibitor_id, title, and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Check authorization (admin or exhibitor owner)
    if (!isAdmin) {
      const { data: exhibitor } = await supabase
        .from('exhibitors')
        .select('owner_user_id')
        .eq('id', exhibitor_id)
        .single()

      if (!exhibitor || exhibitor.owner_user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Not authorized to create novelties for this exhibitor' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check if participation exists
    const { data: participation } = await supabase
      .from('participation')
      .select('id')
      .eq('id_event', event_id)
      .eq('id_exposant', exhibitor_id)
      .single()

    if (!participation) {
      return new Response(
        JSON.stringify({ error: 'Exhibitor must be participating in this event to create novelties' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check publication limits unless admin
    if (!isAdmin) {
      const { data: canPublish, error: limitError } = await supabase
        .rpc('can_publish_novelty', { exhibitor_id, event_id })

      if (limitError) {
        console.error('Error checking publication limits:', limitError)
        return new Response(
          JSON.stringify({ error: 'Failed to check publication limits' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!canPublish) {
        return new Response(
          JSON.stringify({ 
            error: 'Publication limit reached. Upgrade to paid plan to publish more novelties per event.',
            code: 'LIMIT_REACHED'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Validate and limit media URLs
    const mediaUrls = requestData.media_urls ? validateUrls(requestData.media_urls).slice(0, 5) : []

    // Create novelty
    const { data: novelty, error: createError } = await supabase
      .from('novelties')
      .insert({
        event_id,
        exhibitor_id,
        title,
        type,
        reason_1: requestData.reason_1,
        reason_2: requestData.reason_2,
        reason_3: requestData.reason_3,
        audience_tags: requestData.audience_tags,
        media_urls: mediaUrls,
        doc_url: requestData.doc_url,
        availability: requestData.availability,
        stand_info: requestData.stand_info,
        demo_slots: requestData.demo_slots,
        status: 'Published'
      })
      .select(`
        *,
        exhibitors!inner(id, name, slug, logo_url),
        novelty_stats(route_users_count, popularity_score)
      `)
      .single()

    if (createError) {
      console.error('Error creating novelty:', createError)
      return new Response(
        JSON.stringify({ error: 'Failed to create novelty' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize stats for new novelty
    await supabase
      .from('novelty_stats')
      .insert({
        novelty_id: novelty.id,
        route_users_count: 0,
        reminders_count: 0,
        saves_count: 0,
        popularity_score: 0
      })

    return new Response(
      JSON.stringify(novelty),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Create novelty error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})