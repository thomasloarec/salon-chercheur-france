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

    const { event_slug, search = '', limit, offset } = await req.json()

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
    let query = supabase
      .from('participations_with_exhibitors')
      .select('*', { count: 'exact' })
      .eq('id_event_text', eventData.id_event)
      .order('exhibitor_name', { ascending: true })

    // Apply pagination if provided
    if (typeof limit === 'number') {
      const start = offset || 0
      query = query.range(start, start + limit - 1)
    }

    const { data: participations, count, error } = await query

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

    // Récupérer les exhibitor_id depuis participation pour enrichir les données
    const participationIds = (participations || [])
      .map(p => p.id_participation)
      .filter(Boolean)

    let exhibitorUUIDs: Record<string, string> = {}
    let exhibitorData: Record<string, { logo_url?: string; description?: string; website?: string }> = {}
    let legacyExposantData: Record<string, { website?: string; description?: string }> = {}

    if (participationIds.length > 0) {
      // Récupérer les exhibitor_id depuis participation
      const { data: participationDetails } = await supabase
        .from('participation')
        .select('id_participation, exhibitor_id, id_exposant')
        .in('id_participation', participationIds)

      if (participationDetails) {
        participationDetails.forEach(p => {
          if (p.exhibitor_id && p.id_participation) {
            exhibitorUUIDs[p.id_participation] = p.exhibitor_id
          }
        })

        // Récupérer les données depuis exhibitors (modern)
        const uuids = Object.values(exhibitorUUIDs).filter(Boolean)
        if (uuids.length > 0) {
          const { data: exhibitors } = await supabase
            .from('exhibitors')
            .select('id, logo_url, description, website')
            .in('id', uuids)

          if (exhibitors) {
            exhibitors.forEach(e => {
              exhibitorData[e.id] = {
                logo_url: e.logo_url || undefined,
                description: e.description || undefined,
                website: e.website || undefined
              }
            })
          }
        }

        // Pour les participations sans exhibitor_id, récupérer depuis exposants (legacy)
        const legacyIds = participationDetails
          .filter(p => !p.exhibitor_id && p.id_exposant)
          .map(p => p.id_exposant)

        if (legacyIds.length > 0) {
          const { data: legacyExposants } = await supabase
            .from('exposants')
            .select('id_exposant, website_exposant, exposant_description')
            .in('id_exposant', legacyIds)

          if (legacyExposants) {
            legacyExposants.forEach(ex => {
              legacyExposantData[ex.id_exposant] = {
                website: ex.website_exposant || undefined,
                description: ex.exposant_description || undefined
              }
            })
          }
        }
      }
    }

    // Map to expected format with enriched data
    let exhibitors = (participations || []).map(p => {
      const exhibitorUUID = p.id_participation ? exhibitorUUIDs[p.id_participation] : undefined
      const enrichedData = exhibitorUUID ? exhibitorData[exhibitorUUID] : undefined
      const legacyData = p.id_exposant ? legacyExposantData[p.id_exposant] : undefined

      return {
        id: exhibitorUUID || p.id_exposant || String(p.exhibitor_uuid || ''),
        name: p.exhibitor_name || p.id_exposant || '',
        slug: p.id_exposant || String(p.exhibitor_uuid || ''),
        logo_url: enrichedData?.logo_url || null,
        description: enrichedData?.description || legacyData?.description || p.exposant_description || null,
        website: enrichedData?.website || legacyData?.website || p.exhibitor_website || p.participation_website || null,
        stand: p.stand_exposant || null,
        hall: null,
        plan: 'free' as const
      }
    }).filter(e => e.name)

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      exhibitors = exhibitors.filter(exhibitor => 
        exhibitor.name.toLowerCase().includes(searchLower) ||
        (exhibitor.website && exhibitor.website.toLowerCase().includes(searchLower))
      )
    }

    // Sort alphabetically (already sorted in query but just in case)
    exhibitors.sort((a, b) => a.name.localeCompare(b.name))

    return new Response(
      JSON.stringify({ 
        exhibitors,
        total: count || exhibitors.length
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