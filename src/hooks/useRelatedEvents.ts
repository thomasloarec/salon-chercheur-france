import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type RelatedEvent = {
  id: string;
  id_event: string;
  slug: string;
  nom_event: string;
  date_debut: string;
  date_fin: string | null;
  url_image: string | null;
  nom_lieu: string | null;
  ville: string | null;
  sectors: string[]; // UUIDs
  shared_sectors_count: number;
};

/**
 * Événements similaires via la RPC `related_events`.
 * Lot 9 : passé sous React Query (cache + dédoublonnage), sans modifier
 * les paramètres d'appel, les résultats ni leur ordre.
 */
export function useRelatedEvents(eventId: string | null, limit = 6) {
  const query = useQuery({
    queryKey: ['related-events', eventId, limit],
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!eventId) return [] as RelatedEvent[];

      const { data, error } = await supabase.rpc('related_events', {
        p_event_id: eventId,
        p_limit: limit,
      });

      if (error) {
        console.error('Error fetching related events:', error);
        return [] as RelatedEvent[];
      }

      return (data ?? []) as RelatedEvent[];
    },
  });

  return {
    data: (query.data ?? null) as RelatedEvent[] | null,
    isLoading: !!eventId && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
