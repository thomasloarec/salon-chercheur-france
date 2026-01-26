import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date()
    const in7Days = new Date(today.getTime() + 7 * 24 * 3600000)
    const tomorrow = new Date(today.getTime() + 1 * 24 * 3600000)

    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    console.log('Running notifications cron:', {
      today: formatDate(today),
      in7Days: formatDate(in7Days),
      tomorrow: formatDate(tomorrow)
    })

    let notifications7d = 0
    let notifications1d = 0

    // Événements dans 7 jours
    const { data: events7d, error: error7d } = await supabase
      .from('events')
      .select('id, nom_event, slug, date_debut')
      .eq('date_debut', formatDate(in7Days))
      .eq('visible', true)

    if (error7d) {
      console.error('Error fetching 7-day events:', error7d)
    } else {
      console.log('Found events in 7 days:', events7d?.length || 0)

      for (const event of events7d || []) {
        const { data: favorites } = await supabase
          .from('favorites')
          .select('user_id')
          .eq('event_uuid', event.id)

        console.log(`Event ${event.nom_event}: ${favorites?.length || 0} favorites`)

        for (const fav of favorites || []) {
          // Vérifier si notification déjà envoyée
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', fav.user_id)
            .eq('event_id', event.id)
            .eq('type', 'event_reminder_7d')
            .maybeSingle()

          if (!existing) {
            const response = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/notifications-create`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  type: 'event_reminder_7d',
                  user_id: fav.user_id,
                  event_id: event.id,
                  metadata: { 
                    event_name: event.nom_event,
                    event_slug: event.slug
                  }
                })
              }
            )
            
            if (response.ok) {
              notifications7d++
              console.log(`Created 7d reminder for user ${fav.user_id} - event ${event.nom_event}`)
            }
          } else {
            console.log(`7d reminder already exists for user ${fav.user_id} - event ${event.nom_event}`)
          }
        }
      }
    }

    // Événements demain
    const { data: eventsTmrw, error: errorTmrw } = await supabase
      .from('events')
      .select('id, nom_event, slug, date_debut')
      .eq('date_debut', formatDate(tomorrow))
      .eq('visible', true)

    if (errorTmrw) {
      console.error('Error fetching tomorrow events:', errorTmrw)
    } else {
      console.log('Found events tomorrow:', eventsTmrw?.length || 0)

      for (const event of eventsTmrw || []) {
        const { data: favorites } = await supabase
          .from('favorites')
          .select('user_id')
          .eq('event_uuid', event.id)

        console.log(`Event ${event.nom_event}: ${favorites?.length || 0} favorites`)

        for (const fav of favorites || []) {
          // Vérifier si notification déjà envoyée
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', fav.user_id)
            .eq('event_id', event.id)
            .eq('type', 'event_reminder_1d')
            .maybeSingle()

          if (!existing) {
            const response = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/notifications-create`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  type: 'event_reminder_1d',
                  user_id: fav.user_id,
                  event_id: event.id,
                  metadata: { 
                    event_name: event.nom_event,
                    event_slug: event.slug
                  }
                })
              }
            )
            
            if (response.ok) {
              notifications1d++
              console.log(`Created 1d reminder for user ${fav.user_id} - event ${event.nom_event}`)
            }
          } else {
            console.log(`1d reminder already exists for user ${fav.user_id} - event ${event.nom_event}`)
          }
        }
      }
    }

    const result = { 
      success: true,
      timestamp: new Date().toISOString(),
      events_7d: events7d?.length || 0,
      events_tmrw: eventsTmrw?.length || 0,
      notifications_created: {
        reminder_7d: notifications7d,
        reminder_1d: notifications1d
      }
    }

    console.log('Cron completed:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in notifications-cron:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
