import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'

interface PremiumLeadRequest {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  eventId?: string
  eventName?: string
  eventDate?: string
  eventSlug?: string
  topic?: string // 'lead_capture_beta' | 'lead_capture_waitlist' | default (regular premium lead)
  exhibitorId?: string
  requestedByUserId?: string
  context?: string
}

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult instanceof Response) {
    return corsResult;
  }

  try {
    console.log('🔍 Premium lead function called')

    // Use dedicated secrets for Premium Leads (separate from regular Leads Nouveautés)
    const airtableToken = Deno.env.get('AIRTABLE_PREMIUM_PAT')
    const airtableBaseId = Deno.env.get('AIRTABLE_PREMIUM_BASE_ID')

    console.log('📋 Checking premium env vars:', {
      hasToken: !!airtableToken,
      hasBaseId: !!airtableBaseId,
      baseIdValue: airtableBaseId?.substring(0, 10) + '...', // Log first 10 chars for debug
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
      eventName: body.eventName,
      topic: body.topic
    })

    // Handle beta requests (lead capture feature) - map to existing Airtable fields
    if (body.topic === 'lead_capture_beta' || body.topic === 'lead_capture_waitlist') {
      const currentDate = new Date().toISOString().split('T')[0]
      const requestType = body.topic === 'lead_capture_beta' ? 'Capture sur salon (Premium)' : 'Capture sur salon (Waitlist)'
      
      const betaData = {
        fields: {
          'Prénom': 'Demande',
          'Nom': requestType,
          'Email': body.requestedByUserId || 'beta-request@lotexpo.com',
          'Téléphone': '',
          'Entreprise': `Exhibitor: ${body.exhibitorId || 'N/A'}`,
          'Nom Événement': body.eventName || 'Non spécifié',
          'Date Événement': '',
          'Slug Événement': '',
          'ID Événement': body.eventId || '',
          'Date Demande': currentDate,
          'Statut': 'En attente',
          'Source': `LotExpo - ${body.context || 'Espace Exposant'} (Bêta)`,
        }
      }

      const tableName = 'Leads Premium Nouveautés';
      const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(tableName)}`;
      
      console.log('📤 Beta request to Airtable:', betaData);
      
      const airtableResponse = await fetch(airtableUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${airtableToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(betaData),
      })

      if (!airtableResponse.ok) {
        const errorText = await airtableResponse.text()
        console.error('❌ Airtable error:', errorText)
        return new Response(
          JSON.stringify({ error: 'Failed to save beta request', details: errorText }),
          { status: 500, headers: { ...corsResult.headers, 'Content-Type': 'application/json' } }
        )
      }

      const result = await airtableResponse.json()
      return new Response(
        JSON.stringify({ success: true, airtableId: result.id }),
        { status: 200, headers: { ...corsResult.headers, 'Content-Type': 'application/json' } }
      )
    }

    // Regular premium lead (original behavior)
    if (!body.firstName || !body.lastName || !body.email || !body.phone || !body.company) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsResult.headers, 'Content-Type': 'application/json' }
        }
      )
    }

    // Format date for Airtable (date only without time)
    const currentDate = new Date().toISOString().split('T')[0]
    
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
        'Date Demande': currentDate,
        'Statut': 'En attente',
        'Source': 'LotExpo - Page Premium',
      }
    }

    const tableName = 'Leads Premium Nouveautés';
    const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(tableName)}`;
    
    console.log('📤 Sending to Airtable table:', tableName);
    console.log('🔗 Full Airtable URL:', airtableUrl);
    console.log('📤 Payload:', JSON.stringify(airtableData, null, 2));
    
    const airtableResponse = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(airtableData),
    })

    console.log('📡 Airtable response status:', airtableResponse.status)
    console.log('📡 Airtable response headers:', Object.fromEntries(airtableResponse.headers.entries()))

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text()
      console.error('❌ Airtable error response:', errorText)
      
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
        console.error('❌ Airtable error parsed:', errorJson);
      } catch {
        console.error('❌ Airtable error (raw):', errorText);
      }
      
      return new Response(
        JSON.stringify({
          error: 'Failed to save to Airtable',
          details: errorText,
          status: airtableResponse.status,
          url: airtableUrl,
          tableName: tableName
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
