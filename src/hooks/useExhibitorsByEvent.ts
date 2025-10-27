import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EventExhibitorsResponse } from '@/types/lotexpo';

export const useExhibitorsByEvent = (
  eventSlug: string, 
  searchQuery?: string,
  limit?: number,
  offset?: number
) => {
  return useQuery({
    queryKey: ['exhibitors-by-event', eventSlug, searchQuery, limit, offset],
    queryFn: async (): Promise<EventExhibitorsResponse> => {
      // 1) Call Edge Function
      const { data, error } = await supabase.functions.invoke('exhibitors-by-event', {
        body: { event_slug: eventSlug, search: searchQuery, limit, offset }
      });

      // 2) If error OR total === 0 -> fallback to VIEW
      if (error || !data || (Array.isArray(data.exhibitors) && data.exhibitors.length === 0) || data.total === 0) {
        // Get Event_XX from slug
        const { data: eventData } = await supabase
          .from('events')
          .select('id_event')
          .eq('slug', eventSlug)
          .single();

        if (!eventData?.id_event) {
          return { exhibitors: [], total: 0 };
        }

        // Read directly from view with id_event_text
        let query = supabase
          .from('participations_with_exhibitors')
          .select('*', { count: 'exact' })
          .eq('id_event_text', eventData.id_event);

        // Apply pagination if limit provided
        if (typeof limit === 'number') {
          const start = offset || 0;
          query = query.range(start, start + limit - 1);
        }

        const { data: participationData, count } = await query;

        // Récupérer les exhibitor_id et logos depuis participation et exhibitors
        const participationIds = (participationData || [])
          .map(p => p.id_participation)
          .filter(Boolean);

        let exhibitorUUIDs: Record<string, string> = {};
        let exhibitorLogos: Record<string, string> = {};

        if (participationIds.length > 0) {
          // Récupérer les exhibitor_id depuis participation
          const { data: participationDetails } = await supabase
            .from('participation')
            .select('id_participation, exhibitor_id')
            .in('id_participation', participationIds);

          if (participationDetails) {
            participationDetails.forEach(p => {
              if (p.exhibitor_id && p.id_participation) {
                exhibitorUUIDs[p.id_participation] = p.exhibitor_id;
              }
            });

            // Récupérer les logos depuis exhibitors
            const uuids = Object.values(exhibitorUUIDs).filter(Boolean);
            if (uuids.length > 0) {
              const { data: exhibitors } = await supabase
                .from('exhibitors')
                .select('id, logo_url')
                .in('id', uuids);

              if (exhibitors) {
                exhibitors.forEach(e => {
                  if (e.logo_url) {
                    exhibitorLogos[e.id] = e.logo_url;
                  }
                });
              }
            }
          }
        }

        const exhibitors = (participationData || []).map(p => {
          const exhibitorUUID = p.id_participation ? exhibitorUUIDs[p.id_participation] : undefined;
          const logoUrl = exhibitorUUID ? exhibitorLogos[exhibitorUUID] : null;

          return {
            id: exhibitorUUID || p.id_exposant || String(p.exhibitor_uuid || ''),
            name: p.exhibitor_name || p.id_exposant || '',
            slug: p.id_exposant || String(p.exhibitor_uuid || ''),
            logo_url: logoUrl,
            stand: p.stand_exposant || null,
            hall: null,
            plan: 'free' as const
          };
        }).filter(e =>
          e.name && (!searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        // Admin warning if function returned 0 but view has data
        if (data?.total === 0 && exhibitors.length > 0) {
          console.warn(`[ADMIN] Mismatch detected for ${eventSlug}: Edge Function returned 0 exhibitors but view has ${exhibitors.length}`);
        }

        return { exhibitors, total: count || exhibitors.length };
      }

      // 3) Return Edge Function response
      return data as EventExhibitorsResponse;
    },
    enabled: !!eventSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};