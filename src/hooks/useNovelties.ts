import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
}

export interface NoveltiesResponse {
  data: Novelty[];
  total: number;
  page: number;
  pageSize: number;
}

interface UseNoveltiesParams {
  event_id?: string;
  sort?: 'awaited' | 'recent';
  page?: number;
  pageSize?: number;
  sector?: string;
  type?: string;
  month?: string;
  region?: string;
  enabled?: boolean;
}

export const useNovelties = (params: UseNoveltiesParams = {}) => {
  const {
    event_id,
    sort = 'awaited',
    page = 1,
    pageSize = 10,
    enabled = true
  } = params;

  const { user } = useAuth();

  return useQuery({
    queryKey: ['novelties', event_id ?? 'all', sort, page, pageSize],
    queryFn: async (): Promise<NoveltiesResponse> => {
      console.log('🔍 useNovelties fetch starting:', {
        event_id,
        sort,
        page,
        pageSize
      });

      const offset = (page - 1) * pageSize;

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
          exhibitors!inner (
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
        .eq('status', 'published');

      // Filter by event if provided
      if (event_id) {
        query = query.eq('event_id', event_id);
      }

      // Apply sorting
      if (sort === 'recent') {
        query = query.order('created_at', { ascending: false });
      } else {
        // awaited = popularity
        query = query
          .order('novelty_stats.popularity_score', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + pageSize - 1);

      const { data, count, error } = await query;

      if (error) {
        console.error('❌ useNovelties Supabase error:', error);
        throw error;
      }

      console.log('✅ useNovelties fetch result:', {
        total: count,
        returned: data?.length,
        items: data
      });

      // Check user routes
      let userRouteItems: string[] = [];
      if (user && data?.length) {
        const noveltyIds = data.map(n => n.id);
        const { data: routeItems } = await supabase
          .from('route_items')
          .select('novelty_id, user_routes!inner(user_id)')
          .eq('user_routes.user_id', user.id)
          .in('novelty_id', noveltyIds);

        userRouteItems = routeItems?.map(item => item.novelty_id) || [];
      }

      // Add route status
      const noveltiesWithRouteStatus = data?.map(novelty => ({
        ...novelty,
        in_user_route: userRouteItems.includes(novelty.id)
      })) || [];

      return {
        data: noveltiesWithRouteStatus as Novelty[],
        total: count || 0,
        page,
        pageSize
      };
    },
    enabled,
    staleTime: 30_000,
  });
};

export const useCreateNovelty = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noveltyData: Partial<Novelty>) => {
      const { data, error } = await supabase.functions.invoke('novelties-create', {
        body: noveltyData
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch novelties queries
      queryClient.invalidateQueries({ queryKey: ['novelties'] });
      
      toast({
        title: '✅ Nouveauté soumise !',
        description: 'Votre nouveauté a été envoyée avec succès. Elle sera visible après validation par notre équipe.',
      });
    },
    onError: (error: any) => {
      if (error.code === 'LIMIT_REACHED') {
        toast({
          title: 'Limite atteinte',
          description: 'Vous avez atteint la limite d\'1 nouveauté par événement. Passez en plan Pro pour en publier davantage.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erreur',
          description: error.message || 'Impossible de créer la nouveauté.',
          variant: 'destructive',
        });
      }
    },
  });
};

export const useToggleRoute = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ event_id, novelty_id }: { event_id: string; novelty_id: string }) => {
      const { data, error } = await supabase.functions.invoke('route-toggle', {
        body: { event_id, novelty_id }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Update the specific novelty in all relevant queries
      queryClient.setQueriesData(
        { queryKey: ['novelties'] },
        (oldData: NoveltiesResponse | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            data: oldData.data.map(novelty => 
              novelty.id === variables.novelty_id
                ? {
                    ...novelty,
                    in_user_route: data.added,
                    novelty_stats: {
                      ...novelty.novelty_stats,
                      route_users_count: data.route_users_count
                    }
                  }
                : novelty
            )
          };
        }
      );

      toast({
        title: data.added ? 'Ajouté au parcours' : 'Retiré du parcours',
        description: data.added
          ? 'Cette nouveauté a été ajoutée à votre parcours.'
          : 'Cette nouveauté a été retirée de votre parcours.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier votre parcours.',
        variant: 'destructive',
      });
    },
  });
};