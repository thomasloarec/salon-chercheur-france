import { NotificationCard } from "@/components/notifications/NotificationCard"
import { useNotifications } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"
import { Bell, BellOff } from "lucide-react"
import { useState, useEffect } from "react"
import MainLayout from "@/components/layout/MainLayout"

export default function NotificationsPage() {
  const [displayLimit, setDisplayLimit] = useState(10)
  const { 
    notifications, 
    isLoading, 
    unreadCount,
    markAsRead,
    markAllAsViewed
  } = useNotifications()
  
  // Mark all as viewed when page loads
  useEffect(() => {
    markAllAsViewed()
  }, [])
  
  const displayedNotifications = notifications?.slice(0, displayLimit) || []
  const hasMore = (notifications?.length || 0) > displayLimit
  
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <BellOff className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">Aucune notification</h3>
      <p className="text-sm text-muted-foreground">Vous n'avez aucune notification pour le moment</p>
    </div>
  )
  
  return (
    <MainLayout title="Notifications">
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : notifications?.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {displayedNotifications.map(notification => (
                <NotificationCard 
                  key={notification.id}
                  notification={notification}
                  onClick={() => markAsRead(notification.id)}
                />
              ))}
              
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button 
                    onClick={() => setDisplayLimit(prev => prev + 10)}
                    variant="outline"
                  >
                    Voir plus de notifications
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
