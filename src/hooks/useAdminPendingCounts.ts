import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';

export interface AdminPendingCounts {
  novelties: number;       // novelties to moderate
  claims: number;          // exhibitor claim requests pending
  unmanagedExhibitors: number; // exhibitors with at least one pending claim (proxy for "to process")
}

/**
 * Counts of pending administrative actions for sidebar badges.
 * Only fetched when the current user is an admin.
 */
export const useAdminPendingCounts = () => {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin-pending-counts'],
    enabled: !!isAdmin,
    staleTime: 30_000,
    queryFn: async (): Promise<AdminPendingCounts> => {
      const [noveltiesRes, claimsRes] = await Promise.all([
        supabase
          .from('novelties')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'under_review']),
        supabase
          .from('exhibitor_claim_requests')
          .select('exhibitor_id', { count: 'exact' })
          .eq('status', 'pending'),
      ]);

      const noveltiesCount = noveltiesRes.count ?? 0;
      const claimsCount = claimsRes.count ?? 0;
      const distinctExhibitors = new Set(
        (claimsRes.data ?? []).map((r: any) => r.exhibitor_id)
      ).size;

      return {
        novelties: noveltiesCount,
        claims: claimsCount,
        unmanagedExhibitors: distinctExhibitors,
      };
    },
  });
};
