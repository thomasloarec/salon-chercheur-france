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
  reason: string
  images: string[]
  brochure_pdf_url?: string
  stand_info?: string
  created_by: string
}

// Validation function matching client-side schema
function validateNoveltyData(data: any): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  
  console.log('🔍 Validating novelty data:', data)
  
  if (!data.title || data.title.length < 3 || data.title.length > 120) {
    errors.title = 'Titre requis (3-120 caractères)'
  }
  
  const validTypes = ['Launch', 'Update', 'Demo', 'Special_Offer', 'Partnership', 'Innovation']
  if (!data.type || !validTypes.includes(data.type)) {
    errors.type = 'Type de nouveauté requis'
  }
  
  if (!data.reason || data.reason.length < 10 || data.reason.length > 500) {
    errors.reason = 'Raison requise (10-500 caractères)'
  }
  
  if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
    errors.images = 'Au moins une image est requise'
  } else if (data.images.length > 3) {
    errors.images = 'Maximum 3 images autorisées'
  } else {
    // Validate that images are URLs
    for (let i = 0; i < data.images.length; i++) {
      if (typeof data.images[i] !== 'string' || !data.images[i].startsWith('http')) {
        errors.images = 'Les images doivent être des URLs valides'
        break
      }
    }
  }
  
  if (!data.event_id || !data.exhibitor_id) {
    errors.general = 'Informations manquantes (event_id ou exhibitor_id)'
  }
  
  if (!data.created_by) {
    errors.general = 'Utilisateur manquant (created_by)'
  }
  
  console.log('🔍 Validation errors:', errors)
  
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

    let requestData: CreateNoveltyRequest
    try {
      requestData = await req.json()
      console.log('📥 Request body received:', requestData)
    } catch (error) {
      console.error('❌ Invalid JSON body:', error)
      return new Response(
        JSON.stringify({ error: 'Corps de requête JSON invalide', message: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate request data
    const validation = validateNoveltyData(requestData)
    if (!validation.valid) {
      console.error('❌ Validation failed:', validation.errors)
      return new Response(
        JSON.stringify({ 
          error: 'validation_failed', 
          message: 'Données de validation invalides',
          fields: validation.errors 
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { event_id, exhibitor_id, title, type, reason, images, brochure_pdf_url, stand_info } = requestData

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
        reason_1: reason,
        images_count: images?.length || 0,
        status,
        created_by: user.id,
        stand_info,
        brochure_pdf_url
      })
      .select(`
        *,
        exhibitors!inner(id, name, slug, logo_url, approved)
      `)
      .single()

    if (createError) {
      console.error('❌ Database error creating novelty:', createError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create novelty',
          message: createError.message,
          details: createError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Novelty created successfully:', novelty)

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