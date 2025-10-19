import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NoveltyQuota {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}

export const useNoveltyQuota = (exhibitorId?: string, eventId?: string) => {
  return useQuery({
    queryKey: ['novelty-quota', exhibitorId, eventId],
    queryFn: async (): Promise<NoveltyQuota> => {
      if (!exhibitorId || !eventId) {
        return { allowed: true, current: 0, limit: 1, remaining: 1 };
      }

      const { count, error } = await supabase
        .from('novelties')
        .select('*', { count: 'exact', head: true })
        .eq('exhibitor_id', exhibitorId)
        .eq('event_id', eventId)
        .in('status', ['draft', 'pending', 'under_review', 'published']);

      if (error) {
        console.error('[useNoveltyQuota] Error:', error);
        return { allowed: true, current: 0, limit: 1, remaining: 1 };
      }

      const current = count || 0;
      const limit = 1; // Plan gratuit : 1 nouveauté par exposant par événement

      return {
        allowed: current < limit,
        current,
        limit,
        remaining: Math.max(0, limit - current),
      };
    },
    enabled: !!exhibitorId && !!eventId,
    staleTime: 10_000, // Cache 10 secondes
  });
};
