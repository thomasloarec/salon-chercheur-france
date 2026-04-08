import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ExhibitorGovernanceState {
  /** The exhibitor has verified_at set */
  isVerified: boolean;
  /** There is at least one active owner in exhibitor_team_members */
  hasActiveOwner: boolean;
  /** The current user already has a pending claim request */
  hasPendingClaim: boolean;
  /** The current user is already a team member */
  isTeamMember: boolean;
  /** Loading state */
  isLoading: boolean;
}

/**
 * Determines the full governance state for an exhibitor,
 * combining verified_at, team membership, and pending claim status.
 */
export const useExhibitorGovernance = (exhibitorId: string | undefined): ExhibitorGovernanceState => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['exhibitor-governance', exhibitorId, user?.id],
    queryFn: async () => {
      if (!exhibitorId) return { isVerified: false, hasActiveOwner: false, hasPendingClaim: false, isTeamMember: false };

      // Batch all 3 queries in parallel
      const [verifiedRes, ownerRes, claimRes, memberRes] = await Promise.all([
        // 1. Check verified_at
        supabase
          .from('exhibitors')
          .select('verified_at')
          .eq('id', exhibitorId)
          .maybeSingle(),

        // 2. Check has_active_owner via RPC
        supabase.rpc('has_active_owner', { _exhibitor_id: exhibitorId }),

        // 3. Check if user has a pending claim
        user
          ? supabase
              .from('exhibitor_claim_requests')
              .select('id, status')
              .eq('exhibitor_id', exhibitorId)
              .eq('requester_user_id', user.id)
              .eq('status', 'pending')
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        // 4. Check if user is already a team member
        user
          ? supabase
              .from('exhibitor_team_members')
              .select('id')
              .eq('exhibitor_id', exhibitorId)
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      return {
        isVerified: !!verifiedRes.data?.verified_at,
        hasActiveOwner: !!ownerRes.data,
        hasPendingClaim: !!claimRes.data,
        isTeamMember: !!memberRes.data,
      };
    },
    enabled: !!exhibitorId,
    staleTime: 60_000,
  });

  return {
    isVerified: data?.isVerified ?? false,
    hasActiveOwner: data?.hasActiveOwner ?? false,
    hasPendingClaim: data?.hasPendingClaim ?? false,
    isTeamMember: data?.isTeamMember ?? false,
    isLoading,
  };
};
