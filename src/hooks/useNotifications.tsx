import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export interface Notification {
  id: string
  user_id: string
  type: string
  category: string
  title: string
  message: string
  icon: string | null
  novelty_id: string | null
  event_id: string | null
  exhibitor_id: string | null
  comment_id: string | null
  lead_id: string | null
  actor_user_id: string | null
  actor_name: string | null
  actor_email: string | null
  actor_company: string | null
  actor_avatar_url: string | null
  read: boolean
  read_at: string | null
  link_url: string | null
  metadata: any
  group_key: string | null
  group_count: number
  created_at: string
  updated_at: string
}

export const useNotifications = (limit?: number) => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Notification[]
    },
    enabled: !!user,
    refetchInterval: 30000, // Polling toutes les 30 secondes
    staleTime: 20000
  })
  
  // Unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count', user?.id],
    queryFn: async () => {
      if (!user) return 0
      
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      
      if (error) throw error
      return count || 0
    },
    enabled: !!user,
    refetchInterval: 30000
  })
  
  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    }
  })
  
  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('read', false)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    }
  })
  
  // Mark all current notifications as viewed
  const markAllAsViewed = async () => {
    if (!user || !notifications) return

    const unreadIds = notifications
      .filter(n => !n.read)
      .map(n => n.id)

    if (unreadIds.length === 0) return

    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds)

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    }
  }

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    markAllAsViewed
  }
}
