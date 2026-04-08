import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyExhibitorMembership {
  id: string;
  exhibitor_id: string;
  role: 'owner' | 'admin';
  status: 'active' | 'invited' | 'removed';
  created_at: string;
  exhibitor: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    verified_at: string | null;
  };
}

export const useMyExhibitors = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-exhibitors', user?.id],
    queryFn: async (): Promise<MyExhibitorMembership[]> => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('exhibitor_team_members')
        .select(`
          id,
          exhibitor_id,
          role,
          status,
          created_at,
          exhibitors!inner (
            id,
            name,
            slug,
            logo_url,
            verified_at
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        exhibitor_id: row.exhibitor_id,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        exhibitor: row.exhibitors,
      }));
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};
