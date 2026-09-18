import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminInboxThread {
  thread_id: string;
  context_type: string;
  entity_id: string;
  entity_label: string;
  status: string;
  topic: string | null;
  created_by: string | null;
  requester_name: string | null;
  requester_email: string | null;
  last_message_preview: string | null;
  last_user_message_at: string | null;
  last_admin_message_at: string | null;
  first_admin_reply_at: string | null;
  escalated_at: string | null;
  admin_unread_count: number;
  minutes_waiting: number;
  admin_link: string | null;
}

export const ADMIN_SUPPORT_INBOX_KEY = ['admin-support-inbox'] as const;

/**
 * Boîte de réception support de l'administration.
 * Rafraîchie par Realtime et au minimum toutes les 60 secondes.
 */
export function useAdminSupportInbox() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ADMIN_SUPPORT_INBOX_KEY,
    refetchInterval: 60_000,
    staleTime: 15_000,
    queryFn: async (): Promise<AdminInboxThread[]> => {
      const { data, error } = await supabase.rpc('support_admin_inbox', {
        p_status: undefined,
        p_limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as unknown as AdminInboxThread[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('admin-support-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_threads' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_INBOX_KEY });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_INBOX_KEY });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
