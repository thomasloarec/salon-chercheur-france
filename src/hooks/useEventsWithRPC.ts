
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event, SearchFilters } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';

interface SearchEventsParams {
  location_type?: 'department' | 'region' | 'city' | 'text';
  location_value?: string;
  sector_ids?: string[];
  event_types?: string[];
  months?: number[];
  page_num?: number;
  page_size?: number;
}

interface SearchEventsResult {
  events: Event[];
  total_count: number;
}

export const useEventsWithRPC = (filters?: SearchFilters, page: number = 1, pageSize: number = 20) => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@salonspro.com';

  return useQuery({
    queryKey: ['events-rpc', filters, page, pageSize, isAdmin],
    queryFn: async (): Promise<SearchEventsResult> => {
      // Construire les paramètres pour la RPC
      const params: SearchEventsParams = {
        page_num: page,
        page_size: pageSize,
      };

      // Gérer la localisation via la RPC
      if (filters?.locationSuggestion) {
        params.location_type = filters.locationSuggestion.type;
        params.location_value = filters.locationSuggestion.value;
      }

      // Ajouter les filtres secteurs - utiliser les UUIDs des secteurs
      if (filters?.sectorIds && filters.sectorIds.length > 0) {
        params.sector_ids = filters.sectorIds;
      }

      if (filters?.types && filters.types.length > 0) {
        params.event_types = filters.types;
      }

      if (filters?.months && filters.months.length > 0) {
        params.months = filters.months;
      }

      try {
        console.log('🚀 RPC search_events appelée avec params:', params);
        
        // Appel à la RPC avec le bon typage
        const { data, error } = await supabase.rpc('search_events' as any, params);

        if (error) {
          console.error('❌ Erreur RPC search_events:', error);
          throw error;
        }

        console.log('✅ RPC search_events - résultats:', data?.length || 0);

        // Transformer les données pour correspondre au format attendu
        const events: Event[] = (data as any)?.map((item: any) => {
          return {
            id: item.id,
            nom_event: item.nom_event || '',
            description_event: item.description_event,
            date_debut: item.date_debut,
            date_fin: item.date_fin,
            secteur: item.secteur || '',
            nom_lieu: item.nom_lieu,
            ville: item.ville,
            region: item.region,
            country: item.pays,
            url_image: item.url_image,
            url_site_officiel: item.url_site_officiel,
            tags: item.tags,
            tarif: item.tarif,
            affluence: item.affluence,
            estimated_exhibitors: item.estimated_exhibitors,
            is_b2b: item.is_b2b,
            type_event: item.type_event as Event['type_event'],
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_scraped_at: item.last_scraped_at,
            scraped_from: item.scraped_from,
            rue: item.rue,
            code_postal: item.code_postal,
            visible: item.visible,
            slug: item.slug,
            sectors: []
          };
        }) || [];

        const totalCount = (data as any)?.[0]?.total_count || 0;

        return {
          events,
          total_count: totalCount
        };
      } catch (error) {
        console.error('❌ Erreur lors de l\'appel RPC:', error);
        
        // Fallback vers une requête normale si la RPC échoue
        console.log('🔄 Fallback vers requête directe...');
        
        let query = supabase
          .from('events')
          .select('*')
          .eq('visible', true)
          .gte('date_debut', new Date().toISOString().slice(0, 10))
          .order('date_debut', { ascending: true });

        // Appliquer les filtres de localisation en fallback
        if (filters?.locationSuggestion) {
          const { type, value } = filters.locationSuggestion;
          if (type === 'city') {
            query = query.ilike('ville', `%${value}%`);
          } else if (type === 'region') {
            query = query.ilike('region', `%${value}%`);
          } else if (type === 'text') {
            query = query.or(`ville.ilike.%${value}%,region.ilike.%${value}%`);
          }
        }

        // Filtrage par secteur en fallback - utiliser les IDs des secteurs
        if (filters?.sectorIds && filters.sectorIds.length > 0) {
          console.log('🔍 Filtrage par secteurs (IDs):', filters.sectorIds);
          
          // Get event IDs that match the sector IDs
          const { data: eventSectors, error: sectorError } = await supabase
            .from('event_sectors')
            .select('event_id')
            .in('sector_id', filters.sectorIds);
          
          if (sectorError) {
            console.error('❌ Erreur lors de la récupération des event_sectors:', sectorError);
            throw sectorError;
          }
          
          console.log('📊 event_sectors trouvés:', eventSectors?.length || 0);
          
          if (eventSectors && eventSectors.length > 0) {
            const eventIds = eventSectors.map(es => es.event_id);
            console.log('🎯 Event IDs correspondants:', eventIds.length);
            query = query.in('id', eventIds);
          } else {
            // No events match these sectors, return empty result
            console.log('⚠️ Aucun événement trouvé pour ces secteurs');
            return { events: [], total_count: 0 };
          }
        }

        // Apply other filters
        if (filters?.types && filters.types.length > 0) {
          query = query.in('type_event', filters.types);
        }

        if (filters?.months && filters.months.length > 0) {
          const monthConditions = filters.months.map(month => 
            `extract(month from date_debut).eq.${month}`
          ).join(',');
          query = query.or(monthConditions);
        }

        const { data: fallbackData, error: fallbackError } = await query
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (fallbackError) {
          console.error('❌ Erreur fallback:', fallbackError);
          throw fallbackError;
        }

        console.log('✅ Fallback - événements trouvés:', fallbackData?.length || 0);

        // Mapper les données de fallback au format Event
        const fallbackEvents: Event[] = (fallbackData || []).map(item => {
          return {
            id: item.id,
            nom_event: item.nom_event || '',
            description_event: item.description_event,
            date_debut: item.date_debut,
            date_fin: item.date_fin,
            secteur: item.secteur || '',
            nom_lieu: item.nom_lieu,
            ville: item.ville,
            region: item.region,
            country: item.pays,
            url_image: item.url_image,
            url_site_officiel: item.url_site_officiel,
            tags: item.tags,
            tarif: item.tarif,
            affluence: item.affluence,
            estimated_exhibitors: item.estimated_exhibitors,
            is_b2b: item.is_b2b,
            type_event: item.type_event as Event['type_event'],
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_scraped_at: item.last_scraped_at,
            scraped_from: item.scraped_from,
            rue: item.rue,
            code_postal: item.code_postal,
            visible: item.visible,
            slug: item.slug,
            sectors: []
          };
        });

        return {
          events: fallbackEvents,
          total_count: fallbackEvents.length
        };
      }
    },
  });
};
