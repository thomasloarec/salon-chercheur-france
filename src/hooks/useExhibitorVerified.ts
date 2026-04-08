import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Check if an exhibitor is verified (has verified_at set).
 * Uses exhibitors.verified_at as the single source of truth for the public badge.
 */
export const useExhibitorVerified = (exhibitorId: string | undefined) => {
  return useQuery({
    queryKey: ['exhibitor-verified', exhibitorId],
    queryFn: async () => {
      if (!exhibitorId) return false;

      const { data, error } = await supabase
        .from('exhibitors')
        .select('verified_at')
        .eq('id', exhibitorId)
        .maybeSingle();

      if (error) return false;
      return !!data?.verified_at;
    },
    enabled: !!exhibitorId,
    staleTime: 300_000, // 5 min cache
  });
};
