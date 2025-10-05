import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MyNovelty {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  media_urls: string[];
  is_premium?: boolean;
  reason_1?: string;
  exhibitors: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
  };
  events: {
    id: string;
    nom_event: string;
    slug: string;
    ville: string;
    date_debut: string;
    date_fin: string;
  };
  novelty_stats?: {
    route_users_count: number;
    saves_count: number;
    reminders_count: number;
    popularity_score: number;
  };
}

export const useMyNovelties = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-novelties', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('novelties')
        .select(`
          id, title, type, status, created_at, media_urls, is_premium, reason_1,
          exhibitors!inner ( id, name, slug, logo_url ),
          events!inner ( id, nom_event, slug, ville, date_debut, date_fin ),
          novelty_stats ( route_users_count, saves_count, reminders_count, popularity_score )
        `)
        .eq('created_by', user.id)
        .in('status', ['Draft', 'UnderReview', 'Published'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MyNovelty[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
};
