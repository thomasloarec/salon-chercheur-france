
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toggleFavorite } from '@/utils/toggleFavorite';

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
            nom_event,
            description_event,
            date_debut,
            date_fin,
            secteur,
            location,
            ville,
            pays,
            nom_lieu,
            event_url,
            url_image,
            url_site_officiel,
            tags,
            organizer_name,
            organizer_contact,
            tarif,
            affluence,
            estimated_exhibitors,
            is_b2b,
            type_event,
            created_at,
            updated_at,
            last_scraped_at,
            scraped_from,
            rue,
            code_postal,
            visible,
            slug,
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
      return await toggleFavorite(eventId);
    },
    onSuccess: (_, eventId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorite-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-favorite', eventId, user?.id] });
    },
  });
};
