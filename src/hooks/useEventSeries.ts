import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types/event';

/**
 * Detects event series by finding events whose name shares a common prefix
 * (≥2 words) with the current event. Excludes the current event itself.
 */
function extractSeriesPrefix(name: string): string | null {
  // Clean name: remove year, edition numbers, city suffixes
  const cleaned = name
    .replace(/\b20\d{2}\b/g, '')
    .replace(/\b\d+(ème|e|ère)\s*(édition)?\b/gi, '')
    .trim();

  const words = cleaned.split(/\s+/);
  if (words.length < 2) return null;

  // Take the first 2-4 significant words as prefix
  const prefixWords = words.slice(0, Math.min(4, words.length));
  // Need at least 2 words for a meaningful prefix
  if (prefixWords.length < 2) return null;

  return prefixWords.join(' ');
}

export function useEventSeries(event: Pick<Event, 'id' | 'nom_event'> | null) {
  const prefix = event ? extractSeriesPrefix(event.nom_event) : null;

  return useQuery({
    queryKey: ['event-series', event?.id, prefix],
    enabled: !!event && !!prefix,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!prefix || !event) return [];

      // Search by ILIKE prefix match
      const searchPattern = `${prefix}%`;

      const { data, error } = await supabase
        .from('events')
        .select('id, nom_event, slug, date_debut, date_fin, ville, url_image, visible, affluence')
        .ilike('nom_event', searchPattern)
        .eq('visible', true)
        .neq('id', event.id)
        .order('date_debut', { ascending: true })
        .limit(20);

      if (error) {
        console.error('[useEventSeries] error:', error);
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
      }>;
    },
  });
}

export { extractSeriesPrefix };
