import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyPendingClaim {
  id: string;
  exhibitor_id: string;
  status: string;
  created_at: string | null;
  exhibitor: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
  };
}

/**
 * Returns the current user's pending claim requests, joined with
 * basic exhibitor info for display in the profile.
 */
export const useMyPendingClaims = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-pending-claims', user?.id],
    queryFn: async (): Promise<MyPendingClaim[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('exhibitor_claim_requests')
        .select(`
          id,
          exhibitor_id,
          status,
          created_at,
          exhibitors:exhibitor_id (
            id,
            name,
            slug,
            logo_url
          )
        `)
        .eq('requester_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? [])
        .filter((row: any) => row.exhibitors)
        .map((row: any) => ({
          id: row.id,
          exhibitor_id: row.exhibitor_id,
          status: row.status,
          created_at: row.created_at,
          exhibitor: row.exhibitors,
        }));
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};
