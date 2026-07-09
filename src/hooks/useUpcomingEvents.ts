import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event } from '@/types/event';

/**
 * Prochains salons à venir pour la home (parachute SEO / maillage interne).
 * visible = true, is_test = false, date_debut >= aujourd'hui, tri ascendant.
 */
export const useUpcomingEvents = (limit = 8) => {
  return useQuery({
    queryKey: ['upcoming-events', limit],
    queryFn: async (): Promise<Event[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visible', true)
        .eq('is_test', false)
        .gte('date_debut', today)
        .order('date_debut', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('[upcoming-events]', error);
        throw error;
      }

      return (data ?? []) as unknown as Event[];
    },
    staleTime: 300_000,
  });
};