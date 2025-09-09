
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
      console.debug('[useEventsWithRPC] RPC search_events params:', params);
      console.debug('[useEventsWithRPC] Sector IDs (UUIDs):', params.sector_ids);
      console.debug('[useEventsWithRPC] Event types:', params.event_types);
      console.debug('[useEventsWithRPC] Months filtered:', params.months);
      console.debug('[useEventsWithRPC] Region codes:', params.region_codes);
      console.debug('[useEventsWithRPC] Page:', params.page_num, '| Size:', params.page_size);

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
            id_event: item.id_event, // ✅ AJOUTÉ : champ manquant !
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
            // CORRIGÉ: Utiliser departements au lieu d'events_geo
            try {
              const { data: deptData, error: deptError } = await supabase
                .from('departements')
                .select('code')
                .eq('region_code', value);
              
              if (deptError) {
                console.error('❌ Erreur departements fallback:', deptError);
                return { events: [], total_count: 0 };
              }
              
              const deptCodes = deptData?.map(d => d.code) || [];
              console.log('🗺️ Codes départements trouvés pour région', value, ':', deptCodes);
              
              if (deptCodes.length > 0) {
                // Filtrer par les 2 premiers caractères du code postal
                const postalFilters = deptCodes.map(code => `code_postal.like.${code}%`).join(',');
                query = query.or(postalFilters);
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
            id_event: item.id_event, // ✅ AJOUTÉ : champ manquant dans le fallback aussi !
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
