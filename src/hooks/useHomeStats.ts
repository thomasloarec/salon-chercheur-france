import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface HomeStats {
  totalEvents: number;
  totalSectors: number;
  totalExhibitors: number;
}

export const useHomeStats = () => {
  return useQuery({
    queryKey: ['home-stats'],
    queryFn: async (): Promise<HomeStats> => {
      // Fetch events count
      const { count: eventsCount, error: eventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('visible', true);

      if (eventsError) {
        console.error('Error fetching events count:', eventsError);
      }

      // Fetch sectors count
      const { count: sectorsCount, error: sectorsError } = await supabase
        .from('sectors')
        .select('*', { count: 'exact', head: true });

      if (sectorsError) {
        console.error('Error fetching sectors count:', sectorsError);
      }

      // Fetch exhibitors count
      const { count: exhibitorsCount, error: exhibitorsError } = await supabase
        .from('exhibitors')
        .select('*', { count: 'exact', head: true });

      if (exhibitorsError) {
        console.error('Error fetching exhibitors count:', exhibitorsError);
      }

      return {
        totalEvents: eventsCount || 0,
        totalSectors: sectorsCount || 0,
        totalExhibitors: exhibitorsCount || 0,
      };
    },
    staleTime: 300_000, // 5 minutes
  });
};
