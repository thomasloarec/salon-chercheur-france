
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Sector } from '@/types/sector';

export const useSectors = () => {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sectors')
        .select('id, name, description, keywords')
        .order('name');

      if (error) {
        throw error;
      }

      return data as Sector[];
    },
    staleTime: 300_000, // 5 minutes
  });
};

export const useEventSectors = (eventIdEvent: string) => {
  return useQuery({
    queryKey: ['event-sectors', eventIdEvent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_sectors')
        .select(`
          sectors (
            id,
            name,
            description
          )
        `)
        .eq('event_id', eventIdEvent);

      if (error) {
        throw error;
      }

      return data?.map(item => item.sectors).filter(Boolean) as Sector[];
    },
    enabled: !!eventIdEvent,
    staleTime: 300_000, // 5 minutes
  });
};
