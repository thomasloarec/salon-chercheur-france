import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EventExhibitorsResponse } from '@/types/lotexpo';

export const useExhibitorsByEvent = (eventSlug: string, searchQuery?: string) => {
  return useQuery({
    queryKey: ['exhibitors-by-event', eventSlug, searchQuery],
    queryFn: async (): Promise<EventExhibitorsResponse> => {
      try {
        const { data, error } = await supabase.functions.invoke('exhibitors-by-event', {
          body: { event_slug: eventSlug, search: searchQuery }
        });

        if (error) {
          throw new Error(`Failed to fetch exhibitors: ${error.message}`);
        }

        return data;
      } catch (error: any) {
        // Fallback: direct table query using the new VIEW
        try {
          // First get event id_event from slug
          const { data: eventData } = await supabase
            .from('events')
            .select('id_event')
            .eq('slug', eventSlug)
            .single();
            
          if (!eventData) {
            return { exhibitors: [], total: 0 };
          }

          // Use the participations_with_exhibitors view with id_event_text
          const { data: participationData } = await supabase
            .from('participations_with_exhibitors')
            .select('*')
            .eq('id_event_text', eventData.id_event);

          const exhibitors = (participationData || []).map(p => ({
            id: p.id_exposant || String(p.exhibitor_uuid || ''),
            name: p.exhibitor_name || p.id_exposant || '',
            slug: p.id_exposant || String(p.exhibitor_uuid || ''),
            logo_url: null,
            stand: p.stand_exposant || null,
            hall: null,
            plan: 'free' as const
          })).filter(e => e.name && (!searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase())));

          return {
            exhibitors,
            total: exhibitors.length
          };
        } catch (fallbackError) {
          return { exhibitors: [], total: 0 };
        }
      }
    },
    enabled: !!eventSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};