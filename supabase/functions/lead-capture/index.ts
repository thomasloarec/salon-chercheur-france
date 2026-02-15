import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadCaptureRequest {
  novelty_id: string
  lead_type: 'resource_download' | 'meeting_request'
  first_name: string
  last_name: string
  email: string
  phone?: string
  company?: string
  role?: string
  notes?: string
}

const MAX_LEADS_PER_EMAIL_PER_HOUR = 5;

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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestData: LeadCaptureRequest = await req.json()

    // Validate required fields
    const { novelty_id, lead_type, first_name, last_name, email } = requestData
    if (!novelty_id || !lead_type || !first_name || !last_name || !email) {
      return new Response(
        JSON.stringify({ error: 'Champs requis: novelty_id, lead_type, first_name, last_name, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate lead_type
    if (!['resource_download', 'meeting_request'].includes(lead_type)) {
      return new Response(
        JSON.stringify({ error: 'lead_type doit être resource_download ou meeting_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Format email invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize inputs - trim and limit length
    const sanitizedEmail = email.trim().toLowerCase().slice(0, 255)
    const sanitizedFirstName = first_name.trim().slice(0, 100)
    const sanitizedLastName = last_name.trim().slice(0, 100)

    // Create service client for rate limiting check and inserts
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ==========================================
    // RATE LIMITING: max leads per email per hour
    // ==========================================
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentCount, error: countError } = await serviceSupabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('email', sanitizedEmail)
      .gte('created_at', oneHourAgo)

    if (!countError && (recentCount ?? 0) >= MAX_LEADS_PER_EMAIL_PER_HOUR) {
      console.warn(`[lead-capture] Rate limit hit for email: ${sanitizedEmail.slice(0, 3)}***`)
      return new Response(
        JSON.stringify({ error: 'Trop de demandes. Veuillez réessayer dans une heure.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify novelty exists and is published
    const { data: novelty, error: noveltyError } = await supabase
      .from('novelties')
      .select('id, status, resource_url, exhibitor_id, exhibitors!inner(name, owner_user_id)')
      .eq('id', novelty_id)
      .eq('status', 'published')
      .single()

    if (noveltyError || !novelty) {
      return new Response(
        JSON.stringify({ error: 'Nouveauté non trouvée ou non publiée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For resource downloads, check if resource exists
    if (lead_type === 'resource_download' && !novelty.resource_url) {
      return new Response(
        JSON.stringify({ error: 'Aucun dossier de présentation disponible' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create lead record
    const { data: lead, error: leadError } = await serviceSupabase
      .from('leads')
      .insert({
        novelty_id,
        lead_type,
        first_name: sanitizedFirstName,
        last_name: sanitizedLastName,
        email: sanitizedEmail,
        phone: requestData.phone?.trim().slice(0, 20) || null,
        company: requestData.company?.trim().slice(0, 200) || null,
        role: requestData.role?.trim().slice(0, 100) || null,
        notes: requestData.notes?.trim().slice(0, 1000) || null
      })
      .select()
      .single()

    if (leadError) {
      console.error('Error creating lead:', leadError)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'enregistrement du lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update novelty stats
    const statField = lead_type === 'resource_download' ? 'resource_downloads' : 'meeting_requests'
    const { error: statError } = await serviceSupabase.rpc('increment_novelty_stat', {
      p_novelty_id: novelty_id,
      p_field: statField
    })

    if (statError) {
      console.error('Error updating stats:', statError)
    }

    // For resource downloads, generate signed URL
    let downloadUrl = null
    if (lead_type === 'resource_download' && novelty.resource_url) {
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('novelty-resources')
        .createSignedUrl(novelty.resource_url, 3600)

      if (urlError) {
        console.error('Error creating signed URL:', urlError)
      } else {
        downloadUrl = signedUrlData.signedUrl
      }
    }

    const response = {
      success: true,
      lead_id: lead.id,
      message: lead_type === 'resource_download' 
        ? 'Dossier de présentation téléchargeable'
        : 'Demande de rendez-vous enregistrée',
      download_url: downloadUrl
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Lead capture error:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
