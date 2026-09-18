import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Nombre de messages non lus du fil de support en cours pour une entité.
 * Lecture seule via la RPC support_my_thread (pas encore typée).
 */
export function useSupportUnread(
  contextType: 'exhibitor' | 'organizer',
  entityId: string | undefined,
) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!entityId) return;
    const { data, error } = await supabase.rpc('support_my_thread' as never, {
      p_context_type: contextType,
      p_entity_id: entityId,
    } as never);
    if (error) {
      console.error('useSupportUnread:', error);
      return;
    }
    const list = (data ?? []) as Array<{ user_unread_count: number | null }>;
    setUnread(list.reduce((sum, t) => sum + (t.user_unread_count ?? 0), 0));
  }, [contextType, entityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { unread, clear: () => setUnread(0), refresh };
}
