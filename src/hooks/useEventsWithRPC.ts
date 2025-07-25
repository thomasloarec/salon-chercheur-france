
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { convertSecteurToString } from '@/utils/sectorUtils';
import type { Event, SearchFilters } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';

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
      // Construire les paramètres pour la RPC avec region_codes
      const params = {
        sector_ids: filters?.sectorIds || [],
        event_types: filters?.types || [],
        months: filters?.months || [],
        region_codes: [], // Utiliser region_codes au lieu de region_names
        page_num: page,
        page_size: pageSize
      };

      // Gestion de la région via locationSuggestion
      if (filters?.locationSuggestion?.type === 'region') {
        params.region_codes = [filters.locationSuggestion.value];
      }

      // Log détaillé des paramètres envoyés
      console.log('🚀 RPC search_events - Paramètres:', params);
      console.log('📊 Secteurs sélectionnés (UUIDs):', params.sector_ids);
      console.log('🎯 Types d\'événements:', params.event_types);
      console.log('📅 Mois filtrés:', params.months);
      console.log('🌍 Codes région:', params.region_codes);
      console.log('📄 Page:', params.page_num, '| Taille:', params.page_size);

      try {
        // Appel à la RPC avec la nouvelle signature
        const { data, error } = await supabase.rpc('search_events', params);

        if (error) {
          console.error('❌ Erreur RPC search_events:', error);
          throw error;
        }

        // Log détaillé des résultats reçus
        console.log('✅ RPC search_events - Données reçues:', data?.length || 0, 'événements');
        
        if (data && data.length > 0) {
          console.log('🔢 Total count du premier élément:', data[0]?.total_count);
          console.log('🎯 Premier événement reçu:', {
            id: data[0]?.id,  // ✅ Afficher l'UUID maintenant
            nom: data[0]?.nom_event,
            ville: data[0]?.ville
          });
        } else {
          console.log('⚠️ Aucun événement retourné par la RPC');
        }

        // Transformer les données pour correspondre au format attendu
        const events: Event[] = (data as any)?.map((item: any) => {
          return {
            id: item.id,  // ✅ CHANGÉ : utilise l'UUID maintenant retourné par la RPC
            nom_event: item.nom_event || '',
            description_event: item.description_event,
            date_debut: item.date_debut,
            date_fin: item.date_fin,
            secteur: convertSecteurToString(item.secteur),
            nom_lieu: item.nom_lieu,
            ville: item.ville,
            country: item.pays,
            url_image: item.url_image,
            url_site_officiel: item.url_site_officiel,
            tags: [],
            tarif: item.tarif,
            affluence: item.affluence,
            estimated_exhibitors: undefined,
            is_b2b: item.is_b2b,
            type_event: item.type_event as Event['type_event'],
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_scraped_at: undefined,
            scraped_from: undefined,
            rue: item.rue,
            code_postal: item.code_postal,
            visible: item.visible,
            slug: item.slug,
            sectors: []
          };
        }) || [];

        const totalCount = (data as any)?.[0]?.total_count || 0;

        console.log('📋 Résultat final:', {
          events_count: events.length,
          total_count: totalCount
        });

        return {
          events,
          total_count: totalCount
        };
      } catch (error) {
        console.error('❌ Erreur lors de l\'appel RPC:', error);
        
        // Fallback vers une requête directe si la RPC échoue
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
            // Utiliser events_geo pour le filtrage par région
            try {
              const { data: geoEvents, error: geoError } = await supabase
                .from('events_geo')
                .select('id')
                .eq('region_code', value);
              
              if (geoError) {
                console.error('❌ Erreur events_geo:', geoError);
                return { events: [], total_count: 0 };
              }
              
              const eventIds = geoEvents?.map(g => g.id) || [];
              console.log('🗺️ Events IDs trouvés pour région', value, ':', eventIds.length);
              
              if (eventIds.length > 0) {
                query = query.in('id_event', eventIds);
              } else {
                return { events: [], total_count: 0 };
              }
            } catch (geoFallbackError) {
              console.error('❌ Erreur fallback geo:', geoFallbackError);
              return { events: [], total_count: 0 };
            }
          } else if (type === 'text') {
            query = query.or(`ville.ilike.%${value}%,nom_lieu.ilike.%${value}%`);
          }
        }

        // Filtrage par secteur en fallback
        if (filters?.sectorIds && filters.sectorIds.length > 0) {
          console.log('🔍 Fallback - Filtrage par secteurs (IDs):', filters.sectorIds);
          
          try {
            const { data: eventSectors, error: sectorError } = await supabase
              .from('event_sectors')
              .select('event_id')
              .in('sector_id', filters.sectorIds);
            
            console.log('↪ fallback event_sectors rows:', eventSectors);
            
            if (sectorError) {
              console.error('❌ Erreur lors de la récupération des event_sectors:', sectorError);
              throw sectorError;
            }
            
            console.log('📊 event_sectors trouvés:', eventSectors?.length || 0);
            
            if (eventSectors && eventSectors.length > 0) {
              const eventIds = eventSectors.map(es => es.event_id);
              console.log('🎯 Event IDs correspondants:', eventIds.length);
              query = query.in('id_event', eventIds);
            } else {
              console.log('⚠️ Aucun événement trouvé pour ces secteurs');
              return { events: [], total_count: 0 };
            }
          } catch (sectorFallbackError) {
            console.error('❌ Erreur fallback secteurs:', sectorFallbackError);
            return { events: [], total_count: 0 };
          }
        }

        // Apply other filters
        if (filters?.types && filters.types.length > 0) {
          query = query.in('type_event', filters.types);
        }

        if (filters?.months && filters.months.length > 0) {
          const monthFilters = filters.months.map(month => `date_debut >= '${new Date().getFullYear()}-${month.toString().padStart(2, '0')}-01' AND date_debut < '${new Date().getFullYear()}-${(month + 1).toString().padStart(2, '0')}-01'`).join(' OR ');
          query = query.or(monthFilters);
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
            id: item.id,  // ✅ Utiliser l'UUID directement
            nom_event: item.nom_event || '',
            description_event: item.description_event,
            date_debut: item.date_debut,
            date_fin: item.date_fin,
            secteur: convertSecteurToString(item.secteur),
            nom_lieu: item.nom_lieu,
            ville: item.ville,
            country: item.pays,
            url_image: item.url_image,
            url_site_officiel: item.url_site_officiel,
            tags: [],
            tarif: item.tarif,
            affluence: item.affluence,
            estimated_exhibitors: undefined,
            is_b2b: item.is_b2b,
            type_event: item.type_event as Event['type_event'],
            created_at: item.created_at,
            updated_at: item.updated_at,
            last_scraped_at: undefined,
            scraped_from: undefined,
            rue: item.rue,
            code_postal: item.code_postal,
            visible: item.visible,
            slug: item.slug,
            sectors: []
          };
        });

        return {
          events: fallbackEvents,
          total_count: fallbackData?.length || 0
        };
      }
    },
  });
};
