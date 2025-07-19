
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event, SearchFilters } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';
import { getMonthRange } from '@/utils/dateUtils';

export const useEvents = (filters?: SearchFilters) => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@salonspro.com';

  return useQuery({
    queryKey: ['events', filters, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select(`
          *,
          event_sectors (
            sectors (
              id,
              name,
              created_at
            )
          )
        `);

      // IMPORTANT: Filtrer par visibilité sauf pour les admins
      if (!isAdmin) {
        query = query.eq('visible', true);
      }

      query = query
        .eq('is_b2b', true)
        .order('date_debut', { ascending: true });

      // Filtres secteurs - utiliser les IDs des secteurs pour le filtrage
      if (filters?.sectorIds && filters.sectorIds.length > 0) {
        // Inclure les secteurs dans la sélection avec INNER JOIN
        query = supabase
          .from('events')
          .select(`
            *,
            event_sectors!inner(
              sector_id,
              sectors(id, name, created_at)
            )
          `)
          .in('event_sectors.sector_id', filters.sectorIds);

        if (!isAdmin) {
          query = query.eq('visible', true);
        }

        query = query
          .eq('is_b2b', true)
          .order('date_debut', { ascending: true });
      }

      // Filtre « à partir d'aujourd'hui » par défaut (sauf si des mois sont précisés)
      if (!filters?.months || filters.months.length === 0) {
        query = query.gte('date_debut', new Date().toISOString().slice(0, 10));
      }

      // Corriger le filtre Mois - un seul mois
      if (filters?.months?.length === 1) {
        const [month] = filters.months;
        const year = new Date().getFullYear();
        const { fromISO, toISO } = getMonthRange(year, month - 1);

        query = query
          .gte('date_debut', fromISO)
          .lt('date_debut', toISO);
      }

      // Gestion multi-mois
      if (filters?.months && filters.months.length > 1) {
        const year = new Date().getFullYear();
        
        const orString = filters.months
          .map(m => {
            const { fromISO, toISO } = getMonthRange(year, m - 1);
            return `and(date_debut.gte.${fromISO},date_debut.lt.${toISO})`;
          })
          .join(',');

        query = query.or(orString);
      }

      // Legacy support for old sectors filter (by name)
      if (filters?.sectors && filters.sectors.length > 0) {
        const sectorConditions = filters.sectors.map(sectorName => 
          `secteur.eq.${sectorName}`
        ).join(',');
        query = query.or(sectorConditions);
      }

      if (filters?.types && filters.types.length > 0) {
        query = query.in('type_event', filters.types);
      }

      // Filtres existants conservés pour compatibilité
      if (filters?.query) {
        query = query.or(`nom_event.ilike.%${filters.query}%,description_event.ilike.%${filters.query}%,tags.cs.{${filters.query}}`);
      }

      if (filters?.city) {
        query = query.ilike('ville', `%${filters.city}%`);
      }

      // ✅ CORRIGÉ: Remplacer le filtre region par events_geo via locationSuggestion
      if (filters?.locationSuggestion?.type === 'region') {
        try {
          const { data: geoEvents, error: geoError } = await supabase
            .from('events_geo')
            .select('id')
            .eq('region_code', filters.locationSuggestion.value);
          
          if (geoError) {
            console.error('❌ Erreur events_geo dans useEvents:', geoError);
            throw geoError;
          }
          
          const eventIds = geoEvents?.map(g => g.id) || [];
          console.log('🗺️ Events IDs trouvés pour région', filters.locationSuggestion.value, ':', eventIds.length);
          
          if (eventIds.length > 0) {
            query = query.in('id', eventIds);
          } else {
            // Aucun événement dans cette région
            return [];
          }
        } catch (geoError) {
          console.error('❌ Erreur fallback geo dans useEvents:', geoError);
          return [];
        }
      }

      if (filters?.startDate) {
        query = query.gte('date_debut', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('date_fin', filters.endDate);
      }

      if (filters?.minVisitors) {
        query = query.gte('affluence', filters.minVisitors);
      }

      if (filters?.maxVisitors) {
        query = query.lte('affluence', filters.maxVisitors);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }

      // Transform the data to include sectors and use correct column names
      const eventsWithSectors = data?.map(event => ({
        id: event.id,
        nom_event: event.nom_event,
        description_event: event.description_event,
        date_debut: event.date_debut,
        date_fin: event.date_fin,
        secteur: event.secteur,
        nom_lieu: event.nom_lieu,
        ville: event.ville,
        // Region no longer exists in events table
        country: event.pays,
        url_image: event.url_image,
        url_site_officiel: event.url_site_officiel,
        tags: event.tags,
        tarif: event.tarif,
        affluence: event.affluence,
        estimated_exhibitors: event.estimated_exhibitors,
        is_b2b: event.is_b2b,
        type_event: event.type_event as Event['type_event'],
        created_at: event.created_at,
        updated_at: event.updated_at,
        last_scraped_at: event.last_scraped_at,
        scraped_from: event.scraped_from,
        rue: event.rue,
        code_postal: event.code_postal,
        visible: event.visible,
        slug: event.slug,
        sectors: event.event_sectors?.map(es => ({
          id: es.sectors.id,
          name: es.sectors.name,
          created_at: es.sectors.created_at,
        })).filter(Boolean) || []
      })) || [];

      return eventsWithSectors as Event[];
    },
  });
};

// Hook utilitaire pour invalider le cache des événements
export const useInvalidateEvents = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };
};
