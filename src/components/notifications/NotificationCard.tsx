import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
        "flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:bg-accent/50 relative",
        !notification.read ? "bg-primary/5 border-primary/20" : "bg-background"
      )}
    >
      {!notification.read && (
        <div className="absolute top-2 right-2">
          <Badge variant="default" className="text-xs">Nouveau</Badge>
        </div>
      )}
      
      <Avatar className="h-10 w-10">
        <AvatarImage src={notification.actor_avatar_url || undefined} />
        <AvatarFallback>{notification.actor_name?.charAt(0) || '?'}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{notification.actor_name}</p>
            {notification.actor_company && (
              <p className="text-xs text-muted-foreground">{notification.actor_company}</p>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
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
