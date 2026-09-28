import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyNovelty {
  id: string;
  slug: string | null;
  title: string;
  type: string;
  status: string;
  created_at: string;
  media_urls: string[];
  is_premium?: boolean;
  reason_1?: string;
  reason_2?: string | null;
  reason_3?: string | null;
  summary?: string | null;
  details?: string | null;
  stand_info?: string;
  doc_url?: string;
  resource_url?: string | null;
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

export const useMyNovelties = (exhibitorId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-novelties', exhibitorId ?? user?.id],
    queryFn: async () => {
      let query = supabase
        .from('novelties')
        .select(`
          id, slug, title, type, status, created_at, media_urls, is_premium,
          reason_1, reason_2, reason_3, summary, details, stand_info, doc_url, resource_url,
          exhibitors!novelties_exhibitor_id_fkey ( id, name, slug, logo_url ),
          events!inner ( id, nom_event, slug, ville, date_debut, date_fin ),
          novelty_stats ( route_users_count, saves_count, reminders_count, popularity_score ),
          leads ( id, lead_type )
        `);

      if (exhibitorId) {
        query = query.eq('exhibitor_id', exhibitorId);
      } else {
        if (!user?.id) return [];
        query = query.eq('created_by', user.id);
      }

      query = query
        .in('status', ['draft', 'under_review', 'published'])
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Enregistrements : totaux via fonction sécurisée (lot B6 : novelty_likes n'est plus lisible publiquement).
      const ids = (data ?? []).map((n: any) => n.id);
      const likesMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: likesData } = await (supabase as any).rpc('get_novelty_likes_counts', { p_novelty_ids: ids });
        for (const row of (likesData || []) as { novelty_id: string; likes_count: number }[]) {
          likesMap[row.novelty_id] = row.likes_count;
        }
      }

      // Calculate stats with leads
      return data?.map(novelty => ({
        ...novelty,
        stats: {
          likes: likesMap[novelty.id] || 0,
          brochure_leads: novelty.leads?.filter((l: any) => l.lead_type === 'resource_download').length || 0,
          meeting_leads: novelty.leads?.filter((l: any) => l.lead_type === 'meeting_request').length || 0,
          total_leads: novelty.leads?.length || 0,
        }
      })) as MyNovelty[] || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
};
