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
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('events')
        .select('id, nom_event, slug, date_debut, date_fin, ville, url_image, secteur, affluence')
        .eq('ville', ville)
        .eq('visible', true)
        .neq('id', event.id)
        .gte('date_fin', today)
        .lte('date_debut', in30)
        .order('date_debut', { ascending: true })
        .limit(20);

      if (error) {
        console.error('[useSameCityEvents] error:', error);
        return [];
      }

      const rows = (data || []) as Array<{
        id: string;
        nom_event: string;
        slug: string;
        date_debut: string;
        date_fin: string | null;
        ville: string | null;
        url_image: string | null;
        secteur: any;
        affluence: string | null;
      }>;

      // Parse affluence to number for sorting (higher first)
      const parseAffluence = (a: string | null): number => {
        if (!a) return 0;
        const cleaned = String(a).replace(/\./g, '').replace(/\s/g, '').trim();
        const n = parseInt(cleaned, 10);
        return !isNaN(n) && isFinite(n) && n > 0 ? n : 0;
      };

      return rows
        .sort((a, b) => parseAffluence(b.affluence) - parseAffluence(a.affluence))
        .slice(0, 4);
    },
  });
}
