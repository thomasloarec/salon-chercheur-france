import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyNovelty {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  media_urls: string[];
  is_premium?: boolean;
  reason_1?: string;
  stand_info?: string;
  doc_url?: string;
  exhibitor_id?: string;
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
  stats?: {
    likes: number;
    brochure_leads: number;
    meeting_leads: number;
    total_leads: number;
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
          id, title, type, status, created_at, media_urls, is_premium, reason_1, stand_info, doc_url,
          exhibitors!inner ( id, name, slug, logo_url ),
          events!inner ( id, nom_event, slug, ville, date_debut, date_fin ),
          novelty_stats ( route_users_count, saves_count, reminders_count, popularity_score ),
          leads ( id, lead_type )
        `)
        .eq('created_by', user.id)
        .in('status', ['draft', 'under_review', 'published'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Calculate stats with leads
      return data?.map(novelty => ({
        ...novelty,
        stats: {
          likes: novelty.novelty_stats?.route_users_count || 0,
          brochure_leads: novelty.leads?.filter((l: any) => l.lead_type === 'brochure').length || 0,
          meeting_leads: novelty.leads?.filter((l: any) => l.lead_type === 'meeting').length || 0,
          total_leads: novelty.leads?.length || 0,
        }
      })) as MyNovelty[] || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
};
