import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EventExhibitorsResponse } from '@/types/lotexpo';

export const useExhibitorsByEvent = (eventSlug: string, searchQuery?: string) => {
  return useQuery({
    queryKey: ['exhibitors-by-event', eventSlug, searchQuery],
    queryFn: async (): Promise<EventExhibitorsResponse> => {
      const { data, error } = await supabase.functions.invoke('exhibitors-by-event', {
        body: { event_slug: eventSlug, search: searchQuery }
      });

      if (error) {
        console.error('Error fetching exhibitors by event:', error);
        throw new Error(`Failed to fetch exhibitors: ${error.message}`);
      }

      return data;
    },
    enabled: !!eventSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};