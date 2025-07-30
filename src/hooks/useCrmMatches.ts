import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrmMatch {
  id: string;
  name: string;
  website: string;
  provider: 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho';
  eventsCount: number;
  upcomingEvents: Array<{
    id: string;
    nom_event: string;
    date_debut: string;
    ville: string;
  }>;
}

export const useCrmMatches = () => {
  return useQuery({
    queryKey: ['crm-matches'],
    queryFn: async (): Promise<CrmMatch[]> => {
      const { data, error } = await supabase.functions.invoke('get-crm-matches');
      
      if (error) {
        throw new Error(error.message || 'Failed to fetch CRM matches');
      }
      
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};