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
  /** The current user is the direct owner (exhibitors.owner_user_id) */
  isOwner: boolean;
  /**
   * The current user is a validated manager of this exhibitor:
   * direct owner OR active team member (owner/admin). Drives owner-edit UI.
   */
  isManager: boolean;
  /** The resolved UUID from the exhibitors table (null if not found) */
  resolvedExhibitorId: string | null;
  /** Loading state */
  isLoading: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Determines the full governance state for an exhibitor,
 * combining verified_at, team membership, and pending claim status.
 * Accepts either a UUID (exhibitors.id) or a legacy text id (id_exposant),
 * plus an optional name for fallback resolution.
 */
export const useExhibitorGovernance = (
  exhibitorId: string | undefined,
  exhibitorName?: string
): ExhibitorGovernanceState => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['exhibitor-governance', exhibitorId, exhibitorName, user?.id],
    queryFn: async () => {
      const empty = { isVerified: false, hasActiveOwner: false, hasPendingClaim: false, isTeamMember: false, isOwner: false, resolvedExhibitorId: null };
      if (!exhibitorId && !exhibitorName) return empty;

      // Step 1: Resolve to a UUID in the exhibitors table
      let uuid: string | null = null;

      if (exhibitorId && UUID_REGEX.test(exhibitorId)) {
        // Already a UUID — verify it exists
        const { data: ex } = await supabase
          .from('exhibitors')
          .select('id')
          .eq('id', exhibitorId)
          .maybeSingle();
        uuid = ex?.id ?? null;
      }

      // Fallback: resolve by name
      if (!uuid && exhibitorName) {
        const { data: ex } = await supabase
          .from('exhibitors')
          .select('id')
          .ilike('name', exhibitorName)
          .maybeSingle();
        uuid = ex?.id ?? null;
      }

      if (!uuid) return empty;

      // Step 2: Batch governance queries
      const [verifiedRes, ownerRes, claimRes, memberRes] = await Promise.all([
        supabase
          .from('exhibitors')
          .select('verified_at, owner_user_id')
          .eq('id', uuid)
          .maybeSingle(),

        supabase.rpc('has_active_owner', { _exhibitor_id: uuid }),

        user
          ? supabase
              .from('exhibitor_claim_requests')
              .select('id, status')
              .eq('exhibitor_id', uuid)
              .eq('requester_user_id', user.id)
              .eq('status', 'pending')
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        user
          ? supabase
              .from('exhibitor_team_members')
              .select('id')
              .eq('exhibitor_id', uuid)
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
        isOwner: !!(user && verifiedRes.data?.owner_user_id && verifiedRes.data.owner_user_id === user.id),
        resolvedExhibitorId: uuid,
      };
    },
    enabled: !!(exhibitorId || exhibitorName),
    staleTime: 60_000,
  });

  const isOwner = data?.isOwner ?? false;
  const isTeamMember = data?.isTeamMember ?? false;

  return {
    isVerified: data?.isVerified ?? false,
    hasActiveOwner: data?.hasActiveOwner ?? false,
    hasPendingClaim: data?.hasPendingClaim ?? false,
    isTeamMember,
    isOwner,
    isManager: isOwner || isTeamMember,
    resolvedExhibitorId: data?.resolvedExhibitorId ?? null,
    isLoading,
  };
};
