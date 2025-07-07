
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface HomeStats {
  totalEvents: number;
  totalSectors: number;
}

export const useHomeStats = () => {
  return useQuery({
    queryKey: ['home-stats'],
    queryFn: async (): Promise<HomeStats> => {
      // Récupérer le nombre total d'événements
      const { count: eventsCount, error: eventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });

      if (eventsError) {
        console.error('Error fetching events count:', eventsError);
        throw eventsError;
      }

      // Récupérer le nombre total de secteurs
      const { count: sectorsCount, error: sectorsError } = await supabase
        .from('sectors')
        .select('*', { count: 'exact', head: true });

      if (sectorsError) {
        console.error('Error fetching sectors count:', sectorsError);
        throw sectorsError;
      }

      return {
        totalEvents: eventsCount || 0,
        totalSectors: sectorsCount || 0,
      };
    },
    staleTime: 300_000, // 5 minutes
  });
};
