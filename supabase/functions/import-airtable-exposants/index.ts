
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { airtableApiKey, baseId, exposantsTableId, participationTableId } = await req.json()

    if (!airtableApiKey || !baseId || !exposantsTableId) {
      throw new Error('Missing required parameters: airtableApiKey, baseId, exposantsTableId')
    }

    console.log('🎫 Starting Airtable import for exposants and participation')

    // Import exposants
    const exposantsResponse = await fetch(
      `https://api.airtable.com/v0/${baseId}/${exposantsTableId}`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!exposantsResponse.ok) {
      throw new Error(`Airtable API error: ${exposantsResponse.statusText}`)
    }

    const exposantsData = await exposantsResponse.json()
    console.log(`📊 Found ${exposantsData.records?.length || 0} exposants in Airtable`)

    // Upsert exposants
    let exposantsUpserted = 0
    for (const record of exposantsData.records || []) {
      const fields = record.fields
      
      const exposantData = {
        id_exposant: record.id, // Utiliser l'ID Airtable comme clé fonctionnelle
        nom_exposant: fields['Nom'] || fields['nom_exposant'] || 'Sans nom',
        website_exposant: fields['Website'] || fields['website_exposant'] || null,
        exposant_description: fields['Description'] || fields['exposant_description'] || null,
      }

      const { error: exposantError } = await supabase
        .from('exposants')
        .upsert(exposantData, { 
          onConflict: 'id_exposant',
          ignoreDuplicates: false 
        })

      if (exposantError) {
        console.error(`❌ Error upserting exposant ${exposantData.id_exposant}:`, exposantError)
      } else {
        console.log(`🎫 Upserting exposant ${exposantData.id_exposant}`)
        exposantsUpserted++
      }
    }

    // Import participation si fourni
    let participationUpserted = 0
    if (participationTableId) {
      const participationResponse = await fetch(
        `https://api.airtable.com/v0/${baseId}/${participationTableId}`,
        {
          headers: {
            'Authorization': `Bearer ${airtableApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (participationResponse.ok) {
        const participationData = await participationResponse.json()
        console.log(`📊 Found ${participationData.records?.length || 0} participations in Airtable`)

        for (const record of participationData.records || []) {
          const fields = record.fields
          
          // Récupérer l'UUID de l'événement depuis id_event (text)
          const eventIdText = fields['id_event'] || fields['Event ID']
          if (!eventIdText) {
            console.warn(`⚠️ Skipping participation ${record.id}: no event ID`)
            continue
          }

          // Chercher l'événement par id_event (text) pour obtenir l'UUID
          const { data: eventData, error: eventError } = await supabase
            .from('events')
            .select('id')
            .eq('id_event', eventIdText)
            .single()

          if (eventError || !eventData) {
            console.warn(`⚠️ Event not found for id_event ${eventIdText}`)
            continue
          }

          const participationData = {
            id_event: eventData.id, // UUID de l'événement
            id_exposant: fields['id_exposant'] || fields['Exposant ID'],
            stand_exposant: fields['Stand'] || fields['stand_exposant'] || null,
            website_exposant: fields['Website'] || fields['website_exposant'] || null,
            urlexpo_event: fields['URL Expo'] || fields['urlexpo_event'] || null,
          }

          if (!participationData.id_exposant) {
            console.warn(`⚠️ Skipping participation ${record.id}: no exposant ID`)
            continue
          }

          const { error: participationError } = await supabase
            .from('participation')
            .upsert(participationData, { 
              onConflict: 'id_event,id_exposant',
              ignoreDuplicates: false 
            })

          if (participationError) {
            console.error(`❌ Error upserting participation:`, participationError)
          } else {
            console.log(`🤝 Upserting participation ${participationData.id_exposant} → ${eventIdText}`)
            participationUpserted++
          }
        }
      }
    }

    const result = {
      success: true,
      exposantsUpserted,
      participationUpserted,
      message: `Import completed: ${exposantsUpserted} exposants, ${participationUpserted} participations`
    }

    console.log('✅ Import completed:', result)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Import error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
