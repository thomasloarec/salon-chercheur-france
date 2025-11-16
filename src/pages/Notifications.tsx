import { NotificationCard } from "@/components/notifications/NotificationCard"
import { useNotifications } from "@/hooks/useNotifications"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Bell, BellOff } from "lucide-react"
import { useState } from "react"
import MainLayout from "@/components/layout/MainLayout"

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread' | string>('all')
  const { 
    notifications, 
    isLoading, 
    unreadCount,
    markAllAsRead,
    markAsRead 
  } = useNotifications(filter)
  
  const unreadNotifications = notifications?.filter(n => !n.read) || []
  
  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <BellOff className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">Aucune notification</h3>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
  
  return (
    <MainLayout title="Notifications">
      <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <Button onClick={() => markAllAsRead()} variant="outline">
            Tout marquer comme lu
          </Button>
        )}
      </div>
      
      <Tabs value={filter} onValueChange={setFilter} className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="all">
            Toutes ({notifications?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="unread">
            Non lues ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="interaction">
            Interactions
          </TabsTrigger>
          <TabsTrigger value="lead">
            Leads
          </TabsTrigger>
          <TabsTrigger value="favorite_event">
            Favoris
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-2 mt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : notifications?.length === 0 ? (
            <EmptyState message="Vous n'avez aucune notification pour le moment" />
          ) : (
            notifications?.map(notification => (
              <NotificationCard 
                key={notification.id}
                notification={notification}
                onClick={() => markAsRead(notification.id)}
              />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="unread" className="space-y-2 mt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : unreadNotifications.length === 0 ? (
            <EmptyState message="Vous n'avez aucune notification non lue" />
          ) : (
            unreadNotifications.map(notification => (
              <NotificationCard 
                key={notification.id}
                notification={notification}
                onClick={() => markAsRead(notification.id)}
              />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="interaction" className="space-y-2 mt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            (notifications?.filter(n => n.category === 'interaction').length === 0) ? (
              <EmptyState message="Aucune notification d'interaction" />
            ) : (
              notifications?.filter(n => n.category === 'interaction').map(notification => (
                <NotificationCard 
                  key={notification.id}
                  notification={notification}
                  onClick={() => markAsRead(notification.id)}
                />
              ))
            )
          )}
        </TabsContent>
        
        <TabsContent value="lead" className="space-y-2 mt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            (notifications?.filter(n => n.category === 'lead').length === 0) ? (
              <EmptyState message="Aucune notification de lead" />
            ) : (
              notifications?.filter(n => n.category === 'lead').map(notification => (
                <NotificationCard 
                  key={notification.id}
                  notification={notification}
                  onClick={() => markAsRead(notification.id)}
                />
              ))
            )
          )}
        </TabsContent>
        
        <TabsContent value="favorite_event" className="space-y-2 mt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            (notifications?.filter(n => n.category === 'favorite_event').length === 0) ? (
              <EmptyState message="Aucune notification d'événement favori" />
            ) : (
              notifications?.filter(n => n.category === 'favorite_event').map(notification => (
                <NotificationCard 
                  key={notification.id}
                  notification={notification}
                  onClick={() => markAsRead(notification.id)}
                />
              ))
            )
          )}
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  )
}
