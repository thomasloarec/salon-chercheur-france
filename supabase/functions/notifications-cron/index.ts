import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
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

    // Événements dans 7 jours
    const { data: events7d, error: error7d } = await supabase
      .from('events')
      .select('id, nom_event, slug, date_debut')
      .gte('date_debut', formatDate(in7Days))
      .lte('date_debut', formatDate(in7Days))
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
          await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/notifications-create`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
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
        }
      }
    }

    // Événements demain
    const { data: eventsTmrw, error: errorTmrw } = await supabase
      .from('events')
      .select('id, nom_event, slug, date_debut')
      .gte('date_debut', formatDate(tomorrow))
      .lte('date_debut', formatDate(tomorrow))
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
          await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/notifications-create`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
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
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        events_7d: events7d?.length || 0,
        events_tmrw: eventsTmrw?.length || 0
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in notifications-cron:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
