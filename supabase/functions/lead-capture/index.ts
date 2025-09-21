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

    // Verify novelty exists and is published
    const { data: novelty, error: noveltyError } = await supabase
      .from('novelties')
      .select('id, status, resource_url, exhibitor_id, exhibitors!inner(name, owner_user_id)')
      .eq('id', novelty_id)
      .eq('status', 'Published')
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

    // Create lead record using service role
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: lead, error: leadError } = await serviceSupabase
      .from('leads')
      .insert({
        novelty_id,
        lead_type,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        phone: requestData.phone?.trim() || null,
        company: requestData.company?.trim() || null,
        role: requestData.role?.trim() || null,
        notes: requestData.notes?.trim() || null
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
      // Don't fail the request if stats update fails
    }

    // For resource downloads, generate signed URL
    let downloadUrl = null
    if (lead_type === 'resource_download' && novelty.resource_url) {
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('novelty-resources')
        .createSignedUrl(novelty.resource_url, 3600) // 1 hour expiry

      if (urlError) {
        console.error('Error creating signed URL:', urlError)
      } else {
        downloadUrl = signedUrlData.signedUrl
      }
    }

    // TODO: Send notification email to exhibitor owner
    // This would require configuring email service (Resend)

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