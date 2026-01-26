import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow, format } from "date-fns"
import { fr } from "date-fns/locale"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Notification } from "@/hooks/useNotifications"
import { Calendar, MapPin } from "lucide-react"

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
  }
  return icons[type] || '🔔'
}

// Check if notification is an event reminder type
const isEventReminder = (type: string) => 
  type === 'event_reminder_7d' || type === 'event_reminder_1d'

export const NotificationCard = ({ notification, onClick }: NotificationCardProps) => {
  const navigate = useNavigate()
  
  const handleClick = () => {
    onClick() // Mark as read
    if (notification.link_url) {
      navigate(notification.link_url)
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
          "flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:bg-accent/50",
          !notification.read ? "bg-primary/5 border-primary/20" : "bg-background"
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
        "flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:bg-accent/50",
        !notification.read ? "bg-primary/5 border-primary/20" : "bg-background"
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
