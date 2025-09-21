import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Novelty {
  id: string;
  event_id: string;
  exhibitor_id: string;
  title: string;
  type: 'Launch' | 'Prototype' | 'MajorUpdate' | 'LiveDemo' | 'Partnership' | 'Offer' | 'Talk';
  reason_1?: string;
  reason_2?: string;
  reason_3?: string;
  audience_tags?: string[];
  media_urls?: string[];
  doc_url?: string;
  availability?: string;
  stand_info?: string;
  demo_slots?: any;
  status: 'Draft' | 'UnderReview' | 'Published';
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
    sector,
    type,
    month,
    region,
    enabled = true
  } = params;

  return useQuery({
    queryKey: ['novelties', event_id ?? 'all', sort, page, pageSize, sector ?? 'all', type ?? 'all', month ?? 'all', region ?? 'all'],
    queryFn: async (): Promise<NoveltiesResponse> => {
      const { data, error } = await supabase.functions.invoke('novelties-list', {
        body: {
          event_id,
          sort,
          page: page.toString(),
          pageSize: pageSize.toString(),
          sector,
          type,
          month,
          region
        }
      });

      if (error) {
        throw error;
      }

      return data;
    },
    enabled,
    staleTime: 30_000, // 30 seconds
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
        title: 'Nouveauté créée',
        description: 'Votre nouveauté a été publiée avec succès.',
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