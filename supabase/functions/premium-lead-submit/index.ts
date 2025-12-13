import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { z } from 'https://esm.sh/zod@3.23.8'
import { handleCors } from '../_shared/cors.ts'

// Zod schemas for input validation
const betaRequestSchema = z.object({
  topic: z.enum(['lead_capture_beta', 'lead_capture_waitlist']),
  exhibitorId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  eventName: z.string().max(200).optional(),
  eventDate: z.string().optional(),
  eventSlug: z.string().max(200).optional(),
  requestedByUserId: z.string().uuid().optional(),
  context: z.string().max(100).optional(),
})

const premiumLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().min(1, 'Phone is required').max(50),
  company: z.string().min(1, 'Company is required').max(200),
  eventId: z.string().uuid().optional(),
  eventName: z.string().max(200).optional(),
  eventDate: z.string().optional(),
  eventSlug: z.string().max(200).optional(),
  topic: z.string().optional(),
})

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

    const rawBody = await req.json()
    console.log('📨 Request body:', {
      email: rawBody.email,
      company: rawBody.company,
      eventName: rawBody.eventName,
      topic: rawBody.topic
    })

    // Handle beta requests (lead capture feature) - map to existing Airtable fields
    if (rawBody.topic === 'lead_capture_beta' || rawBody.topic === 'lead_capture_waitlist') {
      // Validate beta request
      const parsed = betaRequestSchema.safeParse(rawBody)
      if (!parsed.success) {
        console.error('❌ Validation error:', parsed.error.flatten())
        return new Response(
          JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten() }),
          { status: 422, headers: { ...corsResult.headers, 'Content-Type': 'application/json' } }
        )
      }
      
      const body = parsed.data
      const currentDate = new Date().toISOString().split('T')[0]
      const requestType = body.topic === 'lead_capture_beta' ? 'Capture sur salon (Premium)' : 'Capture sur salon (Waitlist)'
      
      const betaFields: Record<string, string> = {
        'Prénom': 'Demande',
        'Nom': requestType,
        'Email': body.requestedByUserId || 'beta-request@lotexpo.com',
        'Entreprise': `Exhibitor: ${body.exhibitorId || 'N/A'}`,
        'Nom Événement': body.eventName || 'Non spécifié',
        'ID Événement': body.eventId || '',
        'Date Demande': currentDate,
        'Statut': 'En attente',
        'Source': `LotExpo - ${body.context || 'Espace Exposant'} (Bêta)`,
      }

      // Only include date fields if they have valid values
      if (body.eventDate) {
        betaFields['Date Événement'] = body.eventDate;
      }
      if (body.eventSlug) {
        betaFields['Slug Événement'] = body.eventSlug;
      }
      
      const betaData = {
        fields: betaFields
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

    // Regular premium lead - validate with Zod schema
    const parsed = premiumLeadSchema.safeParse(rawBody)
    if (!parsed.success) {
      console.error('❌ Validation error:', parsed.error.flatten())
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten() }),
        { status: 422, headers: { ...corsResult.headers, 'Content-Type': 'application/json' } }
      )
    }
    
    const body = parsed.data

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
