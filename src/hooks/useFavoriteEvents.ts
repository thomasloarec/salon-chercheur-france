
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Event } from '@/types/event';

export const useFavoriteEvents = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['favorite-events', user?.id],
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
            description,
            start_date,
            end_date,
            sector,
            location,
            city,
            region,
            country,
            venue_name,
            event_url,
            image_url,
            tags,
            organizer_name,
            organizer_contact,
            entry_fee,
            estimated_visitors,
            estimated_exhibitors,
            is_b2b,
            event_type,
            created_at,
            updated_at,
            last_scraped_at,
            scraped_from,
            address,
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

      // Transform and sort by start_date ASC
      const events = data?.map((favorite) => {
        const eventData = {
          ...favorite.events,
          event_type: favorite.events.event_type as Event['event_type'],
          sectors: favorite.events.event_sectors?.map(es => ({
            id: es.sectors.id,
            name: es.sectors.name,
            created_at: es.sectors.created_at,
          })).filter(Boolean) || []
        };
        return eventData;
      }).filter(Boolean) || [];

      // Sort by start_date ascending
      events.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

      return events;
    },
    enabled: !!user,
  });
};
