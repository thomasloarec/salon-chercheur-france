import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NoveltyQuota {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  isPremium: boolean;
}

export const useNoveltyQuota = (exhibitorId?: string, eventId?: string) => {
  return useQuery({
    queryKey: ['novelty-quota', exhibitorId, eventId],
    queryFn: async (): Promise<NoveltyQuota> => {
      if (!exhibitorId || !eventId) {
        return { allowed: true, current: 0, limit: 1, remaining: 1, isPremium: false };
      }

      // Check Premium entitlement
      const { data: entitlement } = await supabase
        .from('premium_entitlements')
        .select('*')
        .eq('exhibitor_id', exhibitorId)
        .eq('event_id', eventId)
        .is('revoked_at', null)
        .maybeSingle();

      const isPremium = !!entitlement;
      const limit = isPremium ? entitlement.max_novelties : 1;

      // Count current novelties
      const { count, error } = await supabase
        .from('novelties')
        .select('id', { count: 'exact', head: true })
        .eq('exhibitor_id', exhibitorId)
        .eq('event_id', eventId)
        .in('status', ['draft', 'pending', 'under_review', 'published']);

      if (error) {
        console.error('[useNoveltyQuota] Error:', error);
        return { allowed: true, current: 0, limit, remaining: limit, isPremium };
      }

      const current = count || 0;

      return {
        allowed: current < limit,
        current,
        limit,
        remaining: Math.max(0, limit - current),
        isPremium,
      };
    },
    enabled: !!exhibitorId && !!eventId,
    staleTime: 10_000,
  });
};
