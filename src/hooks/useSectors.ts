
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Sector {
  id: string;
  name: string;
}

export const useSectors = () => {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: async () => {
      console.log('Fetching sectors...');
      const { data, error } = await supabase
        .from('sectors')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching sectors:', error);
        throw error;
      }

      console.log('Sectors fetched:', data);
      return data as Sector[];
    },
  });
};
