import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EventExhibitorsResponse } from '@/types/lotexpo';

/**
 * Hook pour récupérer les exposants d'un événement
 * @param eventSlugOrId - Peut être un slug (events) ou un id_event (Event_XX)
 * @param searchQuery - Filtre de recherche optionnel
 * @param limit - Limite de résultats
 * @param offset - Offset pour pagination
 * @param idEvent - id_event optionnel pour les événements staging (Event_XX)
 */
export const useExhibitorsByEvent = (
  eventSlugOrId: string, 
  searchQuery?: string,
  limit?: number,
  offset?: number,
  idEvent?: string // Nouveau paramètre pour supporter staging
) => {
  return useQuery({
    queryKey: ['exhibitors-by-event', eventSlugOrId, idEvent, searchQuery, limit, offset],
    queryFn: async (): Promise<EventExhibitorsResponse> => {
      console.log('🔍 useExhibitorsByEvent - Fetching pour:', eventSlugOrId, 'id_event:', idEvent);
      
      // Pour les événements staging (slug commence par "pending-"), utiliser id_event_text
      const isStagingEvent = eventSlugOrId.startsWith('pending-');
      
      // 1) Call Edge Function (seulement pour les events publiés avec slug)
      if (!isStagingEvent) {
        const { data, error } = await supabase.functions.invoke('exhibitors-by-event', {
          body: { event_slug: eventSlugOrId, search: searchQuery, limit, offset }
        });

        console.log('📊 Edge Function response:', {
          hasError: !!error,
          totalFromEdge: data?.total,
          exhibitorsCount: data?.exhibitors?.length
        });

        // Si succès avec des données, retourner
        if (!error && data && data.total > 0) {
          return data as EventExhibitorsResponse;
        }
      }

      // 2) Fallback to VIEW - chercher par id_event_text (Event_XX)
      console.log('⚠️ Fallback vers la vue participations_with_exhibitors');
      
      // Déterminer le id_event_text à utiliser
      let eventIdText = idEvent;
      let eventUUID: string | null = null;
      
      if (!eventIdText) {
        // Si pas de id_event fourni, chercher l'événement par slug ou UUID
        if (isStagingEvent) {
          // Extraire l'UUID du slug "pending-UUID"
          const stagingUUID = eventSlugOrId.replace('pending-', '');
          const { data: stagingData } = await supabase
            .from('staging_events_import')
            .select('id, id_event')
            .eq('id', stagingUUID)
            .maybeSingle();
          
          if (stagingData) {
            eventIdText = stagingData.id_event;
            console.log('📌 Staging event trouvé, id_event:', eventIdText);
          }
        } else {
          // Chercher par slug dans events
          const { data: eventData } = await supabase
            .from('events')
            .select('id, id_event')
            .eq('slug', eventSlugOrId)
            .maybeSingle();
          
          if (eventData) {
            eventIdText = eventData.id_event;
            eventUUID = eventData.id;
          }
        }
      }

      if (!eventIdText) {
        console.log('❌ Événement non trouvé');
        return { exhibitors: [], total: 0 };
      }

      console.log('📌 Recherche participations avec id_event_text:', eventIdText);

      // Chercher les participations par id_event_text (la clé fiable)
      let query = supabase
        .from('participations_with_exhibitors')
        .select('*', { count: 'exact' })
        .eq('id_event_text', eventIdText);

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
              .select('id_exposant, nom_exposant, website_exposant, exposant_description')
              .in('id_exposant', legacyIds);

            if (legacyExposants) {
              legacyExposants.forEach(ex => {
                legacyExposantData[ex.id_exposant] = {
                  name: ex.nom_exposant,
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
        
        // Priorité: name_final (vue) > exhibitor_name > legacy_name > nom_exposant (lookup) > id_exposant
        const exhibitorName = p.name_final || 
                              p.exhibitor_name || 
                              p.legacy_name ||
                              (p.id_exposant && legacyExposantData[p.id_exposant]?.name) ||
                              p.id_exposant || '';

        return {
          id: exhibitorUUID || p.id_exposant || String(p.exhibitor_uuid || ''),
          name: exhibitorName,
          exhibitor_name: exhibitorName,
          sortName: exhibitorName.toLowerCase(),
          slug: p.id_exposant || String(p.exhibitor_uuid || ''),
          logo_url: logoUrl,
          description: description,
          website: website,
          stand: p.stand_exposant || null,
          stand_exposant: p.stand_exposant || null,
          hall: null,
          plan: 'free' as const
        };
      }).filter(e =>
        e.name && (!searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));

      console.log('✅ Exhibitors mappés:', exhibitors.length);

      return { exhibitors, total: count || exhibitors.length };
    },
    enabled: !!eventSlugOrId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
};