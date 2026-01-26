import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  type: string
  user_id: string
  novelty_id?: string
  event_id?: string
  exhibitor_id?: string
  actor_user_id?: string
  actor_name?: string
  actor_email?: string
  actor_company?: string
  metadata?: any
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

    const payload: NotificationPayload = await req.json()

    console.log('Creating notification:', { type: payload.type, user_id: payload.user_id })

    let notificationData: any = {
      user_id: payload.user_id,
      type: payload.type,
      actor_user_id: payload.actor_user_id,
      actor_name: payload.actor_name,
      actor_email: payload.actor_email,
      actor_company: payload.actor_company,
      novelty_id: payload.novelty_id,
      event_id: payload.event_id,
      exhibitor_id: payload.exhibitor_id,
      metadata: payload.metadata,
      created_at: new Date().toISOString()
    }

    // Mapping type → contenu
    switch (payload.type) {
      case 'like': {
        const { data: novelty } = await supabase
          .from('novelties')
          .select('title')
          .eq('id', payload.novelty_id)
          .maybeSingle()
        
        notificationData = {
          ...notificationData,
          category: 'interaction',
          title: 'Nouveau like',
          message: `${payload.actor_name} a aimé votre nouveauté ${novelty?.title || ''}`,
          icon: '❤️',
          link_url: `/agenda?tab=exposant&section=novelties&id=${payload.novelty_id}`,
          group_key: `like_novelty_${payload.novelty_id}`
        }
        break
      }

      case 'comment': {
        const { data: noveltyComment } = await supabase
          .from('novelties')
          .select('title')
          .eq('id', payload.novelty_id)
          .maybeSingle()
        
        notificationData = {
          ...notificationData,
          category: 'interaction',
          title: 'Nouveau commentaire',
          message: `${payload.actor_name} a commenté votre nouveauté ${noveltyComment?.title || ''}`,
          icon: '💬',
          link_url: `/agenda?tab=exposant&section=novelties&id=${payload.novelty_id}#comments`
        }
        break
      }

      case 'new_lead_brochure': {
        const { data: noveltyLead } = await supabase
          .from('novelties')
          .select('title')
          .eq('id', payload.novelty_id)
          .maybeSingle()
        
        notificationData = {
          ...notificationData,
          category: 'lead',
          title: 'Nouveau Lead 🎯',
          message: `${payload.actor_name} a téléchargé la brochure de ${noveltyLead?.title || 'votre nouveauté'}`,
          icon: '🎯',
          link_url: `/agenda?tab=exposant&section=novelties&id=${payload.novelty_id}#leads`
        }
        break
      }

      case 'new_lead_rdv': {
        const { data: noveltyRdv } = await supabase
          .from('novelties')
          .select('title')
          .eq('id', payload.novelty_id)
          .maybeSingle()
        
        notificationData = {
          ...notificationData,
          category: 'lead',
          title: 'Nouveau Lead 🎯',
          message: `${payload.actor_name} souhaite prendre rendez-vous - ${noveltyRdv?.title || 'votre nouveauté'}`,
          icon: '📅',
          link_url: `/agenda?tab=exposant&section=novelties&id=${payload.novelty_id}#leads`
        }
        break
      }

      case 'new_novelty_on_favorite': {
        const { data: eventFav } = await supabase
          .from('events')
          .select('nom_event, slug')
          .eq('id', payload.event_id)
          .maybeSingle()
        
        const { data: exhibitor } = await supabase
          .from('exhibitors')
          .select('name')
          .eq('id', payload.exhibitor_id)
          .maybeSingle()
        
        notificationData = {
          ...notificationData,
          category: 'favorite_event',
          title: 'Nouvelle nouveauté',
          message: `${exhibitor?.name || 'Un exposant'} a publié une nouveauté sur ${eventFav?.nom_event || 'un événement'}`,
          icon: '⭐',
          link_url: `/events/${eventFav?.slug}#novelty-${payload.novelty_id}`
        }
        break
      }

      case 'novelty_approved': {
        const { data: noveltyApproved } = await supabase
          .from('novelties')
          .select('title')
          .eq('id', payload.novelty_id)
          .maybeSingle()
        
        notificationData = {
          ...notificationData,
          category: 'exhibitor_mgmt',
          title: 'Nouveauté approuvée',
          message: `Votre nouveauté ${noveltyApproved?.title || ''} a été approuvée`,
          icon: '✅',
          link_url: `/agenda?tab=exposant&section=novelties&id=${payload.novelty_id}`
        }
        break
      }

      case 'plan_limit_reached': {
        notificationData = {
          ...notificationData,
          category: 'exhibitor_mgmt',
          title: 'Limite plan gratuit atteinte',
          message: 'Vous avez atteint la limite de 3 leads - Passez au Premium',
          icon: '👑',
          link_url: '/exposants'
        }
        break
      }

      case 'welcome': {
        notificationData = {
          ...notificationData,
          category: 'system',
          title: 'Bienvenue sur Lotexpo',
          message: 'Découvrez les événements B2B en France',
          icon: '👋',
          link_url: '/'
        }
        break
      }

      case 'event_reminder_7d': {
        const eventName = payload.metadata?.event_name || 'un événement'
        notificationData = {
          ...notificationData,
          category: 'favorite_event',
          title: 'Événement dans 7 jours',
          message: `${eventName} commence dans 7 jours`,
          icon: '📅',
          link_url: payload.metadata?.event_slug ? `/events/${payload.metadata.event_slug}` : '/agenda'
        }
        break
      }

      case 'event_reminder_1d': {
        const eventName = payload.metadata?.event_name || 'un événement'
        notificationData = {
          ...notificationData,
          category: 'favorite_event',
          title: 'Événement demain',
          message: `${eventName} commence demain !`,
          icon: '🔔',
          link_url: payload.metadata?.event_slug ? `/events/${payload.metadata.event_slug}` : '/agenda'
        }
        break
      }

      default:
        throw new Error(`Type de notification inconnu: ${payload.type}`)
    }

    // Vérifier si notification groupée existe (pour likes)
    if (notificationData.group_key) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('*')
        .eq('group_key', notificationData.group_key)
        .eq('user_id', payload.user_id)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // 1h
        .maybeSingle()

      if (existing) {
        // Mettre à jour la notification existante
        const newCount = existing.group_count + 1
        const { data: updated } = await supabase
          .from('notifications')
          .update({
            group_count: newCount,
            message: `${newCount} personnes ont aimé votre nouveauté`,
            updated_at: new Date().toISOString(),
            read: false // Remettre en non lu
          })
          .eq('id', existing.id)
          .select()
          .single()

        console.log('Notification grouped:', { id: existing.id, new_count: newCount })

        return new Response(
          JSON.stringify({ success: true, grouped: true, notification_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Créer nouvelle notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      throw error
    }

    console.log('Notification created:', { id: notification.id })

    return new Response(
      JSON.stringify({ success: true, notification }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notifications-create:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
