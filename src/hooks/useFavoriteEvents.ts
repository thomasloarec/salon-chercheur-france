
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Event } from '@/types/event';

export const useFavoriteEvents = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['favorite-events', user?.id],
    queryFn: async (): Promise<Event[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          event_id,
          created_at,
          events!favorites_event_id_fkey (
            *,
            event_sectors (
              sectors (
                id,
                name,
                created_at
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching favorite events:', error);
        throw error;
      }

      // Transform and map the data properly
      return (data || [])
        .filter(item => item.events) // Filter out any null events
        .map(item => {
          const event = item.events as any;
          return {
            id: event.id,
            id_event: event.id_event,
            nom_event: event.nom_event || '',
            description_event: event.description_event,
            date_debut: event.date_debut,
            date_fin: event.date_fin,
            secteur: event.secteur || '',
            nom_lieu: event.nom_lieu,
            ville: event.ville,
            pays: event.pays,
            url_image: event.url_image,
            url_site_officiel: event.url_site_officiel,
            tarif: event.tarif,
            affluence: event.affluence,
            is_b2b: event.is_b2b,
            type_event: event.type_event as Event['type_event'],
            created_at: event.created_at,
            updated_at: event.updated_at,
            rue: event.rue,
            code_postal: event.code_postal,
            visible: event.visible,
            slug: event.slug,
            sectors: event.event_sectors?.map((es: any) => ({
              id: es.sectors.id,
              name: es.sectors.name,
              created_at: es.sectors.created_at,
            })).filter(Boolean) || [],
            is_favorite: true
          } as Event;
        });
    },
    enabled: !!user,
  });
};
