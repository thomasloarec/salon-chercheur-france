
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Sector } from '@/types/sector';

export const useSectors = () => {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: async () => {
      console.log('Fetching all sectors...');
      const { data, error } = await supabase
        .from('sectors')
        .select('id, name, description, keywords')
        .order('name');

      if (error) {
        console.error('Error fetching sectors:', error);
        throw error;
      }

      console.log('All sectors fetched:', data);
      return data as Sector[];
    },
  });
};

export const useEventSectors = (eventId: string) => {
  return useQuery({
    queryKey: ['event-sectors', eventId],
    queryFn: async () => {
      console.log('Fetching sectors for event:', eventId);
      const { data, error } = await supabase
        .from('event_sectors')
        .select(`
          sectors (
            id,
            name,
            description
          )
        `)
        .eq('event_id', eventId);

      if (error) {
        console.error('Error fetching event sectors:', error);
        throw error;
      }

      console.log('Event sectors fetched:', data);
      return data?.map(item => item.sectors).filter(Boolean) as Sector[];
    },
    enabled: !!eventId,
  });
};
