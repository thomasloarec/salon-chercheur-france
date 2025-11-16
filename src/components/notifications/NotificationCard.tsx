import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Notification } from "@/hooks/useNotifications"

interface NotificationCardProps {
  notification: Notification
  onClick: () => void
}

export const NotificationCard = ({ notification, onClick }: NotificationCardProps) => {
  const navigate = useNavigate()
  
  const handleClick = () => {
    onClick() // Mark as read
    if (notification.link_url) {
      navigate(notification.link_url)
    }
  }
  
  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg cursor-pointer hover:bg-accent transition-colors border",
        !notification.read ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900" : "bg-card border-border"
      )}
    >
      {/* Avatar émetteur ou icône système */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        {notification.actor_avatar_url ? (
          <AvatarImage src={notification.actor_avatar_url} alt={notification.actor_name || ''} />
        ) : (
          <AvatarFallback className="bg-primary/10 text-primary">
            {notification.actor_name?.[0] || notification.icon || '🔔'}
          </AvatarFallback>
        )}
      </Avatar>
      
      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm text-foreground">
              {notification.actor_name && (
                <span className="font-semibold">{notification.actor_name}</span>
              )}
              {notification.actor_name && ' '}
              <span>{notification.message}</span>
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(notification.created_at), { 
              addSuffix: true, 
              locale: fr 
            })}
          </span>
        </div>
        
        {/* Icône type notification et badge non lu */}
        <div className="flex items-center gap-2 mt-1">
          {notification.icon && (
            <span className="text-base">{notification.icon}</span>
          )}
          {!notification.read && (
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          )}
        </div>
      </div>
    </div>
  )
}
