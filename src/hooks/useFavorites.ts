
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useFavorites = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          event_id,
          created_at,
          events (
            id,
            name,
            start_date,
            end_date,
            city,
            image_url,
            slug,
            sector,
            event_sectors (
              sectors (
                id,
                name,
                created_at
              )
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useIsFavorite = (eventId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-favorite', eventId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    },
    enabled: !!user,
  });
};

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('toggle_favorite', {
        p_event: eventId,
      });
      if (error) throw error;
    },
    onSuccess: (_, eventId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-favorite', eventId, user?.id] });
    },
  });
};
