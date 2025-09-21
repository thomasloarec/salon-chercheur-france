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
        // Fallback: direct table query
        try {
          // First get event ID from slug
          const { data: eventData } = await supabase
            .from('events')
            .select('id')
            .eq('slug', eventSlug)
            .single();
            
          if (!eventData) {
            return { exhibitors: [], total: 0 };
          }

          const { data: participationData } = await supabase
            .from('participation')
            .select(`
              stand_exposant,
              exposants!inner(
                id_exposant,
                nom_exposant,
                website_exposant
              )
            `)
            .eq('id_event', eventData.id)
            .order('nom_exposant', { referencedTable: 'exposants', ascending: true });

          const exhibitors = (participationData || []).map(p => ({
            id: p.exposants?.id_exposant || '',
            name: p.exposants?.nom_exposant || '',
            slug: p.exposants?.id_exposant || '',
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