import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Novelty {
  id: string;
  event_id: string;
  exhibitor_id: string;
  title: string;
  type: string;
  reason_1?: string;
  reason_2?: string;
  reason_3?: string;
  audience_tags?: string[];
  media_urls?: string[];
  doc_url?: string;
  availability?: string;
  stand_info?: string;
  demo_slots?: any;
  status: string;
  is_premium?: boolean;
  created_at: string;
  updated_at: string;
  exhibitors: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
  };
  events?: {
    id: string;
    nom_event: string;
    slug: string;
    ville: string;
  };
  novelty_stats?: {
    route_users_count: number;
    popularity_score: number;
  };
  in_user_route?: boolean;
  likes_count?: number;
  comments_count?: number;
}

export interface NoveltiesPage {
  data: Novelty[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

interface UseInfiniteNoveltiesParams {
  event_id?: string;
  sort?: 'awaited' | 'recent';
  pageSize?: number;
  enabled?: boolean;
}

export const useInfiniteNovelties = (params: UseInfiniteNoveltiesParams = {}) => {
  const {
    event_id,
    sort = 'awaited',
    pageSize = 10,
    enabled = true
  } = params;

  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['novelties-infinite', event_id ?? 'all', sort, pageSize],
    queryFn: async ({ pageParam = 1 }): Promise<NoveltiesPage> => {
      console.log('🔍 useInfiniteNovelties fetch starting:', {
        event_id,
        sort,
        page: pageParam,
        pageSize
      });

      // Build query
      let query = supabase
        .from('novelties')
        .select(`
          id,
          event_id,
          exhibitor_id,
          title,
          type,
          reason_1,
          reason_2,
          reason_3,
          audience_tags,
          media_urls,
          doc_url,
          availability,
          stand_info,
          demo_slots,
          status,
          is_premium,
          created_at,
          updated_at,
          exhibitors!novelties_exhibitor_id_fkey (
            id,
            name,
            slug,
            logo_url
          ),
          events!inner (
            id,
            nom_event,
            slug,
            ville
          ),
          novelty_stats (
            route_users_count,
            popularity_score
          )
        `, { count: 'exact' })
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      // Filter by event if provided
      if (event_id) {
        query = query.eq('event_id', event_id);
      }

      const { data, count, error } = await query;

      if (error) {
        console.error('❌ useInfiniteNovelties Supabase error:', error);
        throw error;
      }

      // Filtrer les novelties dont l'exhibitor est null (RLS peut bloquer l'accès)
      const validData = (data || []).filter(novelty => novelty.exhibitors !== null);
      
      console.log('✅ useInfiniteNovelties fetch result:', {
        total: validData.length,
        dbCount: count,
        filtered: (data?.length || 0) - validData.length
      });

      // Fetch likes count and comments count for all novelties
      let likesCountMap: Record<string, number> = {};
      let commentsCountMap: Record<string, number> = {};
      if (validData.length > 0) {
        const noveltyIds = validData.map(n => n.id);
        
        // Fetch likes
        const { data: likesData } = await supabase
          .from('novelty_likes')
          .select('novelty_id')
          .in('novelty_id', noveltyIds);
        
        // Count likes per novelty
        likesCountMap = (likesData || []).reduce((acc, like) => {
          acc[like.novelty_id] = (acc[like.novelty_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Fetch comments
        const { data: commentsData } = await supabase
          .from('novelty_comments')
          .select('novelty_id')
          .in('novelty_id', noveltyIds);
        
        // Count comments per novelty
        commentsCountMap = (commentsData || []).reduce((acc, comment) => {
          acc[comment.novelty_id] = (acc[comment.novelty_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }

      // Add likes count and comments count to each novelty
      const dataWithLikes = validData.map(novelty => ({
        ...novelty,
        likes_count: likesCountMap[novelty.id] || 0,
        comments_count: commentsCountMap[novelty.id] || 0
      }));

      // Sort based on selected filter
      let sortedData = dataWithLikes;
      if (sort === 'awaited') {
        // Les plus attendues: Sort by likes DESC, then comments DESC, then created_at DESC
        sortedData = [...dataWithLikes].sort((a, b) => {
          // First compare likes
          if (b.likes_count !== a.likes_count) {
            return b.likes_count - a.likes_count;
          }
          // If likes are equal, compare comments
          if (b.comments_count !== a.comments_count) {
            return b.comments_count - a.comments_count;
          }
          // If both are equal, sort by most recent
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      } else if (sort === 'recent') {
        // Récentes: Sort only by created_at DESC (most recent first)
        sortedData = [...dataWithLikes].sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      }

      // Check user routes
      let userRouteItems: string[] = [];
      if (user && sortedData.length) {
        const noveltyIds = sortedData.map(n => n.id);
        const { data: routeItems } = await supabase
          .from('route_items')
          .select('novelty_id, user_routes!inner(user_id)')
          .eq('user_routes.user_id', user.id)
          .in('novelty_id', noveltyIds);

        userRouteItems = routeItems?.map(item => item.novelty_id) || [];
      }

      // Add route status
      const noveltiesWithRouteStatus = sortedData.map(novelty => ({
        ...novelty,
        in_user_route: userRouteItems.includes(novelty.id)
      }));

      // Apply pagination AFTER sorting
      const offset = (pageParam - 1) * pageSize;
      const paginatedData = noveltiesWithRouteStatus.slice(offset, offset + pageSize);
      const totalValidCount = noveltiesWithRouteStatus.length;
      const hasNextPage = offset + paginatedData.length < totalValidCount;

      return {
        data: paginatedData as Novelty[],
        total: totalValidCount,
        page: pageParam,
        pageSize,
        hasNextPage
      };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNextPage) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled,
    staleTime: 30_000,
  });
};
