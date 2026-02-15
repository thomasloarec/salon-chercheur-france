import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClaimExhibitorRequest {
  exhibitor_id: string
}

interface CreateExhibitorRequest {
  proposed_name: string
  website?: string
}

interface UpdateExhibitorRequest {
  description?: string
  logo_url?: string
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

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(segment => segment)

    const requestData = await req.json()
    const { action } = requestData

    // Handle different endpoints
    if (req.method === 'POST') {
      if (action === 'list') {
        // GET exhibitors list (via POST for consistency)
        const { event_id, search } = requestData

        if (!event_id) {
          return new Response(
            JSON.stringify({ error: 'event_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          .eq('id_event', event_id)

        const { data: participations, error } = await query

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch exhibitors' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Extract and filter exhibitors
        let exhibitors = (participations || [])
          .map(p => p.exhibitors)
          .filter(Boolean)
          .flat()

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
          JSON.stringify(exhibitors),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } else if (action === 'create') {
        // Create new exhibitor
        // ✅ defer_participation: si true, ne pas créer la participation immédiatement
        // (utilisé quand un exposant est créé avec une nouveauté en attente de validation)
        const { name, website, description, stand_info, logo_url, event_id, defer_participation } = requestData

        if (!name || !event_id) {
          return new Response(
            JSON.stringify({ error: 'name and event_id are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // ÉTAPE 1 : Créer l'exposant moderne
        const { data: newExhibitor, error: createError } = await supabase
          .from('exhibitors')
          .insert({
            name,
            website: website || null,
            description: description || null,
            stand_info: stand_info || null,
            logo_url: logo_url || null,
            approved: false,
            owner_user_id: user.id
          })
          .select()
          .single()

        if (createError || !newExhibitor) {
          console.error('❌ Failed to create exhibitor:', createError)
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create exhibitor',
              details: createError 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('✅ Exhibitor created:', newExhibitor.id)

        // ÉTAPE 2 : Créer l'entrée legacy dans exposants (avec UUID comme id_exposant)
        const { error: legacyError } = await supabase
          .from('exposants')
          .insert({
            id_exposant: newExhibitor.id, // ✅ UUID directement au lieu de timestamp
            nom_exposant: name,
            website_exposant: website || null,
            exposant_description: description || null
          })

        if (legacyError) {
          console.error('⚠️ Failed to create legacy exposant:', legacyError)
          // Ne pas échouer, mais logger pour investigation
        } else {
          console.log('✅ Legacy exposant created with id:', newExhibitor.id)
        }

        // ✅ ÉTAPE 3 : Créer la participation SEULEMENT si defer_participation n'est pas true
        // Si defer_participation est true, la participation sera créée quand la nouveauté sera publiée
        if (!defer_participation) {
          // Récupérer l'id_event_text depuis events
          const { data: eventData } = await supabase
            .from('events')
            .select('id_event')
            .eq('id', event_id)
            .single()

          if (!eventData?.id_event) {
            console.error('❌ Event id_event not found for UUID:', event_id)
          }

          // Créer la participation avec LES DEUX IDs + id_event_text
          const { error: participationError } = await supabase
            .from('participation')
            .insert({
              id_exposant: newExhibitor.id,      // ✅ UUID (compatible TEXT)
              exhibitor_id: newExhibitor.id,     // ✅ UUID (natif)
              id_event: event_id,                // ✅ UUID (natif)
              id_event_text: eventData?.id_event || null, // ✅ TEXT pour la vue
              website_exposant: website || null,
              stand_exposant: stand_info || null,
              urlexpo_event: null
            })
          
          if (participationError) {
            console.error('❌ Failed to create participation:', participationError)
            return new Response(
              JSON.stringify({ 
                error: 'Exhibitor created but participation failed',
                exhibitor_id: newExhibitor.id,
                details: participationError
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          console.log('✅ Participation created for event:', event_id)
        } else {
          console.log('⏸️ Participation deferred - will be created when novelty is published')
        }

        // Auto-approve claim if email domain matches website domain
        let claimStatus = 'pending'
        if (website && user.email) {
          const userDomain = user.email.split('@')[1]?.toLowerCase()
          const websiteDomain = website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase()
          
          if (userDomain && websiteDomain && websiteDomain.includes(userDomain)) {
            claimStatus = 'approved'
            // Update exhibitor as approved
            await supabase
              .from('exhibitors')
              .update({ approved: true })
              .eq('id', newExhibitor.id)
          }
        }

        // Create claim request
        await supabase
          .from('exhibitor_claim_requests')
          .insert({
            exhibitor_id: newExhibitor.id,
            requester_user_id: user.id,
            status: claimStatus
          })

        return new Response(
          JSON.stringify({ 
            ...newExhibitor,
            approved: claimStatus === 'approved',
            participation_deferred: !!defer_participation
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } else if (pathSegments.includes('claim')) {
        // POST /exhibitors/claim
        const { exhibitor_id }: ClaimExhibitorRequest = await req.json()

        if (!exhibitor_id) {
          return new Response(
            JSON.stringify({ error: 'exhibitor_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if exhibitor exists
        const { data: exhibitor } = await supabase
          .from('exhibitors')
          .select('id, name, owner_user_id')
          .eq('id', exhibitor_id)
          .single()

        if (!exhibitor) {
          return new Response(
            JSON.stringify({ error: 'Exhibitor not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (exhibitor.owner_user_id) {
          return new Response(
            JSON.stringify({ error: 'Exhibitor already has an owner' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create claim request
        const { data: claimRequest, error: claimError } = await supabase
          .from('exhibitor_claim_requests')
          .insert({
            exhibitor_id,
            requester_user_id: user.id
          })
          .select()
          .single()

        if (claimError) {
          if (claimError.code === '23505') {
            return new Response(
              JSON.stringify({ error: 'Claim request already exists' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          console.error('Error creating claim request:', claimError)
          return new Response(
            JSON.stringify({ error: 'Failed to create claim request' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify(claimRequest),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } else if (pathSegments.includes('create-request')) {
        // POST /exhibitors/create-request
        const { proposed_name, website }: CreateExhibitorRequest = await req.json()

        if (!proposed_name) {
          return new Response(
            JSON.stringify({ error: 'proposed_name is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create exhibitor creation request
        const { data: createRequest, error: createError } = await supabase
          .from('exhibitor_create_requests')
          .insert({
            proposed_name,
            website,
            requester_user_id: user.id
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating exhibitor request:', createError)
          return new Response(
            JSON.stringify({ error: 'Failed to create exhibitor request' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify(createRequest),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } else {
        // POST /exhibitors/:id/update
        const exhibitorId = pathSegments[pathSegments.length - 2] // Get ID before 'update'
        const { description, logo_url }: UpdateExhibitorRequest = await req.json()

        if (!exhibitorId) {
          return new Response(
            JSON.stringify({ error: 'Exhibitor ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if user is admin via server-side RPC
        const { data: isAdmin } = await supabase.rpc('is_admin')

        if (!isAdmin) {
          const { data: exhibitor } = await supabase
            .from('exhibitors')
            .select('owner_user_id')
            .eq('id', exhibitorId)
            .single()

          if (!exhibitor || exhibitor.owner_user_id !== user.id) {
            return new Response(
              JSON.stringify({ error: 'Not authorized to update this exhibitor' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Update exhibitor
        const updateData: any = {}
        if (description !== undefined) updateData.description = description
        if (logo_url !== undefined) updateData.logo_url = logo_url

        const { data: updatedExhibitor, error: updateError } = await supabase
          .from('exhibitors')
          .update(updateData)
          .eq('id', exhibitorId)
          .select()
          .single()

        if (updateError) {
          console.error('Error updating exhibitor:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update exhibitor' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify(updatedExhibitor),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // GET /exhibitors (for event exhibitors list)
    if (req.method === 'GET') {
      const eventId = url.searchParams.get('event_id')
      const search = url.searchParams.get('q')

      if (!eventId) {
        return new Response(
          JSON.stringify({ error: 'event_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let query = supabase
        .from('exhibitors')
        .select(`
          id,
          name,
          slug,
          logo_url,
          participation!inner(stand_exposant, urlexpo_event)
        `)
        .eq('participation.id_event', eventId)

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }

      query = query.order('name')

      const { data: exhibitors, error } = await query

      if (error) {
        console.error('Error fetching exhibitors:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch exhibitors' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(exhibitors || []),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Exhibitor management error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})