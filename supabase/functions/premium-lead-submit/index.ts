import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'

interface PremiumLeadRequest {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  eventId: string
  eventName: string
  eventDate: string
  eventSlug: string
}

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult instanceof Response) {
    return corsResult;
  }

  try {
    console.log('🔍 Premium lead function called')

    const airtableToken = Deno.env.get('AIRTABLE_PAT') || Deno.env.get('AIRTABLE_TOKEN')
    const airtableBaseId = Deno.env.get('AIRTABLE_BASE_ID')

    console.log('📋 Checking env vars:', {
      hasToken: !!airtableToken,
      hasBaseId: !!airtableBaseId,
    })

    if (!airtableToken || !airtableBaseId) {
      console.error('❌ Missing Airtable credentials')
      return new Response(
        JSON.stringify({
          error: 'Configuration error: Missing Airtable credentials',
        }),
        {
          status: 500,
          headers: { ...corsResult.headers, 'Content-Type': 'application/json' }
        }
      )
    }

    const body: PremiumLeadRequest = await req.json()
    console.log('📨 Request body:', {
      email: body.email,
      company: body.company,
      eventName: body.eventName
    })

    if (!body.firstName || !body.lastName || !body.email || !body.phone || !body.company) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsResult.headers, 'Content-Type': 'application/json' }
        }
      )
    }

    const airtableData = {
      fields: {
        'Prénom': body.firstName,
        'Nom': body.lastName,
        'Email': body.email,
        'Téléphone': body.phone,
        'Entreprise': body.company,
        'Nom Événement': body.eventName || 'Non spécifié',
        'Date Événement': body.eventDate || '',
        'Slug Événement': body.eventSlug || '',
        'ID Événement': body.eventId || '',
        'Date Demande': new Date().toISOString(),
        'Statut': 'En attente',
        'Source': 'LotExpo - Page Premium',
      }
    }

    console.log('📤 Sending to Airtable table: Leads Premium Nouveautés')

    const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/Leads%20Premium%20Nouveaut%C3%A9s`
    
    const airtableResponse = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(airtableData),
    })

    console.log('📡 Airtable response status:', airtableResponse.status)

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text()
      console.error('❌ Airtable error:', errorText)
      
      return new Response(
        JSON.stringify({
          error: 'Failed to save to Airtable',
          details: errorText,
          status: airtableResponse.status
        }),
        {
          status: 500,
          headers: { ...corsResult.headers, 'Content-Type': 'application/json' }
        }
      )
    }

    const airtableResult = await airtableResponse.json()
    console.log('✅ Airtable success:', airtableResult.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Premium lead registered successfully',
        airtableId: airtableResult.id
      }),
      {
        status: 200,
        headers: { ...corsResult.headers, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('💥 Unexpected error:', error)
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsResult.headers, 'Content-Type': 'application/json' }
      }
    )
  }
})
