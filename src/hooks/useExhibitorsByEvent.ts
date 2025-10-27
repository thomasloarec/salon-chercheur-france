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
      console.log('🔍 useExhibitorsByEvent - Fetching pour:', eventSlug);
      
      // 1) Call Edge Function
      const { data, error } = await supabase.functions.invoke('exhibitors-by-event', {
        body: { event_slug: eventSlug, search: searchQuery, limit, offset }
      });

      console.log('📊 Edge Function response:', {
        hasError: !!error,
        totalFromEdge: data?.total,
        exhibitorsCount: data?.exhibitors?.length
      });

      // 2) If error OR total === 0 -> fallback to VIEW
      if (error || !data || data.total === 0) {
        console.log('⚠️ Fallback vers la vue participations_with_exhibitors');
        // Get Event UUID and id_event from slug
        const { data: eventData } = await supabase
          .from('events')
          .select('id, id_event')
          .eq('slug', eventSlug)
          .single();

        if (!eventData) {
          console.log('❌ Événement non trouvé');
          return { exhibitors: [], total: 0 };
        }

        console.log('📌 Event trouvé:', {
          id: eventData.id,
          id_event: eventData.id_event
        });

        // ✅ DOUBLE MATCH : Chercher par UUID ET id_event_text
        let query = supabase
          .from('participations_with_exhibitors')
          .select('*', { count: 'exact' })
          .or(`id_event.eq.${eventData.id},id_event_text.eq.${eventData.id_event}`);

        // Apply pagination if limit provided
        if (typeof limit === 'number') {
          const start = offset || 0;
          query = query.range(start, start + limit - 1);
        }

        const { data: participationData, count, error: viewError } = await query;

        if (viewError) {
          console.error('❌ Erreur vue:', viewError);
          return { exhibitors: [], total: 0 };
        }

        console.log('📋 Résultats de la vue:', {
          count,
          rows: participationData?.length
        });

        // Récupérer les exhibitor_id et logos depuis participation et exhibitors
        const participationIds = (participationData || [])
          .map(p => p.id_participation)
          .filter(Boolean);

        let exhibitorUUIDs: Record<string, string> = {};
        let exhibitorLogos: Record<string, string> = {};
        let exhibitorDescriptions: Record<string, string> = {};
        let exhibitorWebsites: Record<string, string> = {};
        let legacyExposantData: Record<string, any> = {};

        if (participationIds.length > 0) {
          // Récupérer les exhibitor_id depuis participation
          const { data: participationDetails } = await supabase
            .from('participation')
            .select('id_participation, exhibitor_id, id_exposant')
            .in('id_participation', participationIds);

          if (participationDetails) {
            participationDetails.forEach(p => {
              if (p.exhibitor_id && p.id_participation) {
                exhibitorUUIDs[p.id_participation] = p.exhibitor_id;
              }
            });

            // Récupérer les logos et descriptions depuis exhibitors (modern)
            const uuids = Object.values(exhibitorUUIDs).filter(Boolean);
            if (uuids.length > 0) {
              const { data: exhibitors } = await supabase
                .from('exhibitors')
                .select('id, logo_url, description, website')
                .in('id', uuids);

              if (exhibitors) {
                exhibitors.forEach(e => {
                  if (e.logo_url) exhibitorLogos[e.id] = e.logo_url;
                  if (e.description) exhibitorDescriptions[e.id] = e.description;
                  if (e.website) exhibitorWebsites[e.id] = e.website;
                });
              }

              console.log('✅ Logos récupérés:', Object.keys(exhibitorLogos).length);
            }

            // Pour les participations sans exhibitor_id, récupérer depuis exposants (legacy)
            const legacyIds = participationDetails
              .filter(p => !p.exhibitor_id && p.id_exposant)
              .map(p => p.id_exposant);

            if (legacyIds.length > 0) {
              const { data: legacyExposants } = await supabase
                .from('exposants')
                .select('id_exposant, website_exposant, exposant_description')
                .in('id_exposant', legacyIds);

              if (legacyExposants) {
                legacyExposants.forEach(ex => {
                  legacyExposantData[ex.id_exposant] = {
                    website: ex.website_exposant,
                    description: ex.exposant_description
                  };
                });
              }
            }
          }
        }

        const exhibitors = (participationData || []).map(p => {
          const exhibitorUUID = p.id_participation ? exhibitorUUIDs[p.id_participation] : undefined;
          const logoUrl = exhibitorUUID ? exhibitorLogos[exhibitorUUID] : null;
          const description = exhibitorUUID ? exhibitorDescriptions[exhibitorUUID] : 
                             (p.id_exposant && legacyExposantData[p.id_exposant]?.description) || 
                             p.exposant_description;
          const website = exhibitorUUID ? exhibitorWebsites[exhibitorUUID] :
                         (p.id_exposant && legacyExposantData[p.id_exposant]?.website) ||
                         p.exhibitor_website || 
                         p.participation_website;

          return {
            id: exhibitorUUID || p.id_exposant || String(p.exhibitor_uuid || ''),
            name: p.exhibitor_name || p.id_exposant || '',
            slug: p.id_exposant || String(p.exhibitor_uuid || ''),
            logo_url: logoUrl,
            description: description,
            website: website,
            stand: p.stand_exposant || null,
            hall: null,
            plan: 'free' as const
          };
        }).filter(e =>
          e.name && (!searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        console.log('✅ Exhibitors mappés:', exhibitors.length);

        return { exhibitors, total: count || exhibitors.length };
      }

      // 3) Return Edge Function response
      return data as EventExhibitorsResponse;
    },
    enabled: !!eventSlug,
    staleTime: 0,  // ✅ Pas de cache
    gcTime: 0,  // ✅ Garbage collect immédiatement
    refetchOnMount: 'always',  // ✅ Toujours recharger
    refetchOnWindowFocus: true,  // ✅ Recharger si on revient sur l'onglet
  });
};