import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow, format } from "date-fns"
import { fr } from "date-fns/locale"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Notification } from "@/hooks/useNotifications"
import { Calendar, MapPin, Radar } from "lucide-react"

interface NotificationCardProps {
  notification: Notification
  onClick: () => void
}

// Helper pour obtenir l'icône selon le type
const getNotificationIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'like': '❤️',
    'comment': '💬',
    'new_lead_brochure': '🎯',
    'new_lead_rdv': '📅',
    'new_novelty_on_favorite': '⭐',
    'novelty_approved': '✅',
    'novelty_rejected': '❌',
    'plan_limit_reached': '👑',
    'welcome': '👋',
    'event_reminder_7d': '📅',
    'event_reminder_1d': '🔔',
    'radar_new_matches': '🎯',
    'claim_approved': '🎉',
    'claim_request': '📥',
    'novelty_visit_milestone': '👀',
  }
  return icons[type] || '🔔'
}

// Check if notification is an event reminder type
const isEventReminder = (type: string) => 
  type === 'event_reminder_7d' || type === 'event_reminder_1d'

// Sanitize notification link URLs
const sanitizeLinkUrl = (url: string | null): string | null => {
  if (!url) return null
  
  // Fix legacy /evenements/ → /events/
  let cleaned = url.replace(/^\/evenements\//, '/events/')
  
  // Remove fragments with undefined (e.g., #novelty-undefined)
  cleaned = cleaned.replace(/#[a-z]+-undefined$/, '')
  
  // Remove query params with undefined values (e.g., &id=undefined)
  cleaned = cleaned.replace(/([?&])id=undefined/g, (match, prefix) => {
    // If it's the first param, remove the ?
    return prefix === '?' ? '?' : ''
  })
  // Clean up trailing ? or & 
  cleaned = cleaned.replace(/[?&]$/, '')
  // Clean up ?& → ?
  cleaned = cleaned.replace(/\?&/, '?')
  
  return cleaned || null
}

export const NotificationCard = ({ notification, onClick }: NotificationCardProps) => {
  const navigate = useNavigate()
  
  const handleClick = () => {
    onClick() // Mark as read
    const cleanUrl = sanitizeLinkUrl(notification.link_url)
    if (cleanUrl) {
      navigate(cleanUrl)
    }
  }

  // Extract event data from metadata for event reminders
  const eventMetadata = notification.metadata as {
    event_name?: string
    event_slug?: string
    event_image?: string
    event_date_debut?: string
    event_date_fin?: string
    event_ville?: string
    event_nom_lieu?: string
  } | null

  // Radar CRM specific render
  if (notification.type === 'radar_new_matches') {
    const meta = (notification.metadata ?? {}) as {
      eventName?: string
      eventDate?: string
      eventCity?: string
      eventImage?: string
      companies?: Array<{ companyName?: string }>
    }
    const formatDateSafe = (s?: string) => {
      if (!s) return null
      try { return format(new Date(s), 'd MMM yyyy', { locale: fr }) } catch { return s }
    }
    const companies = Array.isArray(meta.companies) ? meta.companies : []
    const firstNames = companies.slice(0, 3).map((c) => c?.companyName).filter(Boolean) as string[]
    const remaining = Math.max(0, companies.length - firstNames.length)
    const dateLabel = formatDateSafe(meta.eventDate)

    return (
      <div
        onClick={handleClick}
        className={cn(
          "flex items-start gap-4 p-4 rounded-lg border transition-colors duration-300 cursor-pointer",
          !notification.read
            ? "bg-[#ffe8d9] hover:bg-[#ffdcc6] border-primary/20"
            : "bg-white hover:bg-primary/50"
        )}
      >
        <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-muted">
          {meta.eventImage ? (
            <img src={meta.eventImage} alt={meta.eventName || 'Événement'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
              <Radar className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">Radar CRM</Badge>
            {!notification.read && (
              <Badge variant="default" className="text-xs">Nouveau</Badge>
            )}
          </div>
          <p className="font-semibold text-sm break-words">{notification.title}</p>
          <p className="text-sm text-foreground break-words">{notification.message}</p>
          <span className="block text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
          </span>

          {firstNames.length > 0 && (
            <p className="text-xs text-muted-foreground break-words">
              {firstNames.join(', ')}{remaining > 0 ? ` + ${remaining} autre${remaining > 1 ? 's' : ''}` : ''}
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {dateLabel && (
              <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /><span>{dateLabel}</span></div>
            )}
            {meta.eventCity && (
              <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /><span>{meta.eventCity}</span></div>
            )}
          </div>

          <p className="text-xs text-primary">Voir l'opportunité →</p>
        </div>
      </div>
    )
  }

  // For event reminders, show a special card layout
  if (isEventReminder(notification.type) && eventMetadata) {
    const formatEventDate = (dateStr: string) => {
      try {
        return format(new Date(dateStr), 'd MMM yyyy', { locale: fr })
      } catch {
        return dateStr
      }
    }

    return (
      <div 
        onClick={handleClick}
        className={cn(
          "flex items-start gap-4 p-4 rounded-lg border transition-colors duration-300 cursor-pointer",
          !notification.read
            ? "bg-[#ffe8d9] hover:bg-[#ffdcc6] border-primary/20"
            : "bg-white hover:bg-primary/50"
        )}
      >
        {/* Event image thumbnail */}
        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
          {eventMetadata.event_image ? (
            <img 
              src={eventMetadata.event_image} 
              alt={eventMetadata.event_name || 'Événement'} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl bg-primary/10">
              {getNotificationIcon(notification.type)}
            </div>
          )}
        </div>
        
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">
                  {notification.title}
                </p>
                {!notification.read && (
                  <Badge variant="default" className="text-xs flex-shrink-0">Nouveau</Badge>
                )}
              </div>
              <p className="text-base font-medium text-foreground mt-1 line-clamp-2">
                {eventMetadata.event_name}
              </p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {formatDistanceToNow(new Date(notification.created_at), { 
                addSuffix: true,
                locale: fr 
              })}
            </span>
          </div>
          
          {/* Event details */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(eventMetadata.event_date_debut || eventMetadata.event_date_fin) && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {eventMetadata.event_date_debut && formatEventDate(eventMetadata.event_date_debut)}
                  {eventMetadata.event_date_fin && eventMetadata.event_date_debut !== eventMetadata.event_date_fin && (
                    <> - {formatEventDate(eventMetadata.event_date_fin)}</>
                  )}
                </span>
              </div>
            )}
            {(eventMetadata.event_ville || eventMetadata.event_nom_lieu) && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>
                  {eventMetadata.event_nom_lieu && <>{eventMetadata.event_nom_lieu}, </>}
                  {eventMetadata.event_ville}
                </span>
              </div>
            )}
          </div>
          
          <p className="text-xs text-primary">Voir l'événement →</p>
        </div>
      </div>
    )
  }
  
  // Standard notification card for other types
  return (
    <div 
      onClick={handleClick}
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border transition-colors duration-300 cursor-pointer",
        !notification.read
          ? "bg-[#ffe8d9] hover:bg-[#ffdcc6] border-primary/20"
          : "bg-white hover:bg-primary/50"
      )}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={notification.actor_avatar_url || undefined} />
        <AvatarFallback className="text-lg">
          {notification.icon || getNotificationIcon(notification.type)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{notification.title}</p>
              {!notification.read && (
                <Badge variant="default" className="text-xs flex-shrink-0">Nouveau</Badge>
              )}
            </div>
            {notification.actor_name && (
              <p className="text-xs text-muted-foreground">
                {notification.actor_name}
                {notification.actor_company && ` • ${notification.actor_company}`}
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatDistanceToNow(new Date(notification.created_at), { 
              addSuffix: true,
              locale: fr 
            })}
          </span>
        </div>
        
        <p className="text-sm text-foreground">{notification.message}</p>
        
        {notification.link_url && (
          <p className="text-xs text-primary">Voir plus →</p>
        )}
      </div>
    </div>
  )
}
