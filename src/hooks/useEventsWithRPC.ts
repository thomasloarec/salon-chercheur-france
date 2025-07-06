
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

      // Ajouter les filtres secteurs - utiliser les noms des secteurs directement
      if (filters?.sectors && filters.sectors.length > 0) {
        params.sector_ids = filters.sectors;
      } else if (filters?.sectorIds && filters.sectorIds.length > 0) {
        params.sector_ids = filters.sectorIds;
      }

      if (filters?.types && filters.types.length > 0) {
        params.event_types = filters.types;
      }

      if (filters?.months && filters.months.length > 0) {
        params.months = filters.months;
      }

      try {
        // Appel à la RPC avec le bon typage
        const { data, error } = await supabase.rpc('search_events' as any, params);

        if (error) {
          console.error('❌ Erreur RPC search_events:', error);
          throw error;
        }

        // Transformer les données pour correspondre au format attendu
        const events: Event[] = (data as any)?.map((item: any) => {
          // 📡 DIAGNOSTIC: Log RPC row data
          console.log('📡 RPC row', { 
            id: item.id,
            postal_code: item.postal_code, 
            city: item.city,
            address: item.address,
            full_item: item
          });
          
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            start_date: item.start_date,
            end_date: item.end_date,
            sector: item.sector,
            location: item.location,
            city: item.city,
            region: item.region,
            country: item.country,
            venue_name: item.venue_name,
            event_url: item.event_url,
            image_url: item.image_url,
            tags: item.tags,
            organizer_name: item.organizer_name,
            organizer_contact: item.organizer_contact,
            entry_fee: item.entry_fee,
            estimated_visitors: item.estimated_visitors,
            estimated_exhibitors: item.estimated_exhibitors,
            is_b2b: item.is_b2b,
            event_type: item.event_type as Event['event_type'],
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_scraped_at: item.last_scraped_at,
            scraped_from: item.scraped_from,
            address: item.address,
            postal_code: item.postal_code,
            visible: item.visible,
            slug: item.slug,
            sectors: item.sectors || []
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
        let query = supabase
          .from('events')
          .select('*, address, postal_code, city')
          .eq('visible', true)
          .gte('start_date', new Date().toISOString().slice(0, 10))
          .order('start_date', { ascending: true });

        // Appliquer les filtres de localisation en fallback
        if (filters?.locationSuggestion) {
          const { type, value } = filters.locationSuggestion;
          if (type === 'city') {
            query = query.ilike('city', `%${value}%`);
          } else if (type === 'region') {
            query = query.ilike('region', `%${value}%`);
          } else if (type === 'text') {
            query = query.or(`city.ilike.%${value}%,region.ilike.%${value}%,location.ilike.%${value}%`);
          }
        }

        // Filtrage par secteur en fallback
        if (filters?.sectors && filters.sectors.length > 0) {
          const sectorFilter = filters.sectors.map(sector => `sector.ilike.%${sector}%`).join(',');
          query = query.or(sectorFilter);
        }

        const { data: fallbackData, error: fallbackError } = await query
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (fallbackError) {
          throw fallbackError;
        }

        // 📡 DIAGNOSTIC: Log fallback data
        if (fallbackData && fallbackData.length > 0) {
          console.log('📡 Fallback row', { 
            postal_code: fallbackData[0].postal_code, 
            city: fallbackData[0].city,
            address: fallbackData[0].address
          });
        }

        // Mapper les données de fallback au format Event
        const fallbackEvents: Event[] = (fallbackData || []).map(item => {
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            start_date: item.start_date,
            end_date: item.end_date,
            sector: item.sector,
            location: item.location,
            city: item.city,
            region: item.region,
            country: item.country,
            venue_name: item.venue_name,
            event_url: item.event_url,
            image_url: item.image_url,
            tags: item.tags,
            organizer_name: item.organizer_name,
            organizer_contact: item.organizer_contact,
            entry_fee: item.entry_fee,
            estimated_visitors: item.estimated_visitors,
            estimated_exhibitors: item.estimated_exhibitors,
            is_b2b: item.is_b2b,
            event_type: item.event_type as Event['event_type'],
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_scraped_at: item.last_scraped_at,
            scraped_from: item.scraped_from,
            address: item.address,
            postal_code: item.postal_code,
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
