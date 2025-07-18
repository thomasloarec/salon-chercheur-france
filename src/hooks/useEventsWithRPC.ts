
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

        // Log de contrôle temporaire
        if (process.env.NODE_ENV === 'development') {
          console.log('🪝 events sample →', data?.[0]?.address || data?.[0]?.rue, data?.[0]?.postal_code || data?.[0]?.code_postal, data?.[0]?.city || data?.[0]?.ville);
        }

        // Transformer les données pour correspondre au format attendu
        const events: Event[] = (data as any)?.map((item: any) => {
          // 📡 DIAGNOSTIC: Log RPC row data
          console.log('📡 RPC row', { 
            id: item.id,
            code_postal: item.code_postal || item.postal_code, 
            ville: item.ville || item.city,
            rue: item.rue || item.address,
            visible: item.visible,
            full_item: item
          });
          
          return {
            id: item.id,
            nom_event: item.nom_event || item.name || '',
            description_event: item.description_event || item.description,
            date_debut: item.date_debut || item.start_date,
            date_fin: item.date_fin || item.end_date,
            secteur: item.secteur || item.sector || '',
            nom_lieu: item.nom_lieu || item.venue_name,
            ville: item.ville || item.city,
            region: item.region,
            country: item.pays || item.country,
            url_image: item.url_image || item.image_url,
            url_site_officiel: item.url_site_officiel || item.website_url,
            tags: item.tags,
            tarif: item.tarif || item.entry_fee,
            affluence: item.affluence || item.estimated_visitors,
            estimated_exhibitors: item.estimated_exhibitors,
            is_b2b: item.is_b2b,
            type_event: (item.type_event || item.event_type) as Event['type_event'],
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_scraped_at: item.last_scraped_at,
            scraped_from: item.scraped_from,
            rue: item.rue || item.address,
            code_postal: item.code_postal || item.postal_code,
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
          .select('*')
          .eq('visible', true) // IMPORTANT: ne charger que les événements visibles
          .gte('date_debut', new Date().toISOString().slice(0, 10))
          .order('date_debut', { ascending: true });

        // Appliquer les filtres de localisation en fallback
        if (filters?.locationSuggestion) {
          const { type, value } = filters.locationSuggestion;
          if (type === 'city') {
            query = query.or(`ville.ilike.%${value}%,city.ilike.%${value}%`);
          } else if (type === 'region') {
            query = query.ilike('region', `%${value}%`);
          } else if (type === 'text') {
            query = query.or(`ville.ilike.%${value}%,city.ilike.%${value}%,region.ilike.%${value}%`);
          }
        }

        // Filtrage par secteur en fallback - utiliser contains pour JSON
        if (filters?.sectors && filters.sectors.length > 0) {
          const sectorConditions = filters.sectors.map(sector => 
            `secteur.cs.["${sector}"]`
          ).join(',');
          query = query.or(sectorConditions);
        } else if (filters?.sectorIds && filters.sectorIds.length > 0) {
          const sectorConditions = filters.sectorIds.map(sectorId => 
            `secteur.cs.["${sectorId}"]`
          ).join(',');
          query = query.or(sectorConditions);
        }

        const { data: fallbackData, error: fallbackError } = await query
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (fallbackError) {
          throw fallbackError;
        }

        // Log de contrôle temporaire pour le fallback
        if (process.env.NODE_ENV === 'development') {
          console.log('🪝 fallback events sample →', fallbackData?.[0]?.address || fallbackData?.[0]?.rue, fallbackData?.[0]?.postal_code || fallbackData?.[0]?.code_postal, fallbackData?.[0]?.city || fallbackData?.[0]?.ville);
        }

        // 📡 DIAGNOSTIC: Log fallback data
        if (fallbackData && fallbackData.length > 0) {
          console.log('📡 Fallback row', { 
            code_postal: fallbackData[0].code_postal || fallbackData[0].postal_code, 
            ville: fallbackData[0].ville || fallbackData[0].city,
            rue: fallbackData[0].rue || fallbackData[0].address,
            visible: fallbackData[0].visible
          });
        }

        // Mapper les données de fallback au format Event
        const fallbackEvents: Event[] = (fallbackData || []).map(item => {
          return {
            id: item.id,
            nom_event: item.nom_event || item.name || '',
            description_event: item.description_event || item.description,
            date_debut: item.date_debut || item.start_date,
            date_fin: item.date_fin || item.end_date,
            secteur: item.secteur || item.sector || '',
            nom_lieu: item.nom_lieu || item.venue_name,
            ville: item.ville || item.city,
            region: item.region,
            country: item.pays || item.country,
            url_image: item.url_image || item.image_url,
            url_site_officiel: item.url_site_officiel || item.website_url,
            tags: item.tags,
            tarif: item.tarif || item.entry_fee,
            affluence: item.affluence || item.estimated_visitors,
            estimated_exhibitors: item.estimated_exhibitors,
            is_b2b: item.is_b2b,
            type_event: (item.type_event || item.event_type) as Event['type_event'],
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_scraped_at: item.last_scraped_at,
            scraped_from: item.scraped_from,
            rue: item.rue || item.address,
            code_postal: item.code_postal || item.postal_code,
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
