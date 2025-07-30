
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
          event_uuid,
          created_at,
          events!favorites_event_uuid_fkey (
            id,
            id_event,
            nom_event,
            description_event,
            date_debut,
            date_fin,
            secteur,
            location,
            ville,
            pays,
            nom_lieu,
            url_image,
            url_site_officiel,
            tarif,
            affluence,
            is_b2b,
            type_event,
            created_at,
            updated_at,
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
      
      // Utiliser maybeSingle() au lieu de single() pour éviter les erreurs 406
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_uuid', eventId)
        .maybeSingle();

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
    mutationFn: async ({ eventUuid, eventExternalId }: { eventUuid: string; eventExternalId: string }) => {
      return await toggleFavorite(eventUuid, eventExternalId);
    },
    onSuccess: (_, { eventUuid }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorite-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['is-favorite', eventUuid, user?.id] });
    },
  });
};
