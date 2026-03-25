import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types/event';

/**
 * Fetches up to 4 future visible events in the same city, excluding the current event.
 */
export function useSameCityEvents(event: Pick<Event, 'id' | 'ville'> | null) {
  const ville = event?.ville;

  return useQuery({
    queryKey: ['same-city-events', event?.id, ville],
    enabled: !!event && !!ville,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!ville || !event) return [];

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('events')
        .select('id, nom_event, slug, date_debut, date_fin, ville, url_image, secteur')
        .eq('ville', ville)
        .eq('visible', true)
        .neq('id', event.id)
        .gte('date_fin', today)
        .order('date_debut', { ascending: true })
        .limit(4);

      if (error) {
        console.error('[useSameCityEvents] error:', error);
        return [];
      }

      return (data || []) as Array<{
        id: string;
        nom_event: string;
        slug: string;
        date_debut: string;
        date_fin: string | null;
        ville: string | null;
        url_image: string | null;
        secteur: any;
      }>;
    },
  });
}
