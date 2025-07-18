
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
          events (
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
            name_event: event.name || '',
            description_event: event.description,
            date_debut: event.start_date,
            date_fin: event.end_date,
            secteur: event.sector || '',
            nom_lieu: event.venue_name,
            ville: event.city,
            region: event.region,
            country: event.country,
            url_image: event.image_url,
            url_site_officiel: event.website_url,
            tags: event.tags,
            tarif: event.entry_fee,
            affluence: event.estimated_visitors,
            estimated_exhibitors: event.estimated_exhibitors,
            is_b2b: event.is_b2b,
            type_event: event.event_type as Event['type_event'],
            created_at: event.created_at,
            updated_at: event.updated_at,
            last_scraped_at: event.last_scraped_at,
            scraped_from: event.scraped_from,
            rue: event.address,
            code_postal: event.postal_code,
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
