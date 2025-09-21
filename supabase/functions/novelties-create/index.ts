import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateNoveltyRequest {
  event_id: string
  exhibitor_id: string
  title: string
  type: 'Launch' | 'Update' | 'Demo' | 'Special_Offer' | 'Partnership' | 'Innovation'
  reason_1: string
  images?: { position: number }[]
  brochure?: { filename: string }
}

// Validation function matching client-side schema
function validateNoveltyData(data: any): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  
  if (!data.title || data.title.length < 3 || data.title.length > 120) {
    errors.title = 'Titre requis (3-120 caractères)'
  }
  
  const validTypes = ['Launch', 'Update', 'Demo', 'Special_Offer', 'Partnership', 'Innovation']
  if (!data.type || !validTypes.includes(data.type)) {
    errors.type = 'Type de nouveauté requis'
  }
  
  if (!data.reason_1 || data.reason_1.length < 10 || data.reason_1.length > 500) {
    errors.reason_1 = 'Raison requise (10-500 caractères)'
  }
  
  if (data.images && data.images.length > 3) {
    errors.images = 'Maximum 3 images autorisées'
  }
  
  return { valid: Object.keys(errors).length === 0, errors }
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

    // Validate request data
    const validation = validateNoveltyData(requestData)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', field_errors: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { event_id, exhibitor_id, title, type, reason_1 } = requestData

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Check authorization (admin or exhibitor owner/approved claim)
    if (!isAdmin) {
      const { data: exhibitor } = await supabase
        .from('exhibitors')
        .select('owner_user_id, approved')
        .eq('id', exhibitor_id)
        .single()

      if (!exhibitor) {
        return new Response(
          JSON.stringify({ error: 'Exhibitor not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user is owner or has approved claim
      const isOwner = exhibitor.owner_user_id === user.id
      if (!isOwner) {
        const { data: claim } = await supabase
          .from('exhibitor_claim_requests')
          .select('status')
          .eq('exhibitor_id', exhibitor_id)
          .eq('requester_user_id', user.id)
          .eq('status', 'approved')
          .single()

        if (!claim) {
          return new Response(
            JSON.stringify({ error: 'Not authorized for this exhibitor' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Check plan limits
    const { data: canAdd, error: limitError } = await supabase.rpc('can_add_novelty', {
      p_exhibitor_id: exhibitor_id,
      p_user_id: user.id
    })

    if (limitError) {
      return new Response(
        JSON.stringify({ error: 'Failed to check limits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!canAdd) {
      return new Response(
        JSON.stringify({ 
          error: 'Plan limit reached. Upgrade to add more novelties.',
          code: 'LIMIT_REACHED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine status based on exhibitor approval
    const { data: exhibitor } = await supabase
      .from('exhibitors')
      .select('approved')
      .eq('id', exhibitor_id)
      .single()

    const status = exhibitor?.approved ? 'published' : 'pending'

    // Create novelty
    const { data: novelty, error: createError } = await supabase
      .from('novelties')
      .insert({
        event_id,
        exhibitor_id,
        title,
        type,
        reason_1,
        images_count: requestData.images?.length || 0,
        status,
        created_by: user.id
      })
      .select(`
        *,
        exhibitors!inner(id, name, slug, logo_url, approved)
      `)
      .single()

    if (createError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create novelty' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize stats
    await supabase
      .from('novelty_stats')
      .insert({
        novelty_id: novelty.id,
        likes: 0,
        saves: 0,
        resource_downloads: 0,
        meeting_requests: 0
      })

    return new Response(
      JSON.stringify(novelty),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})