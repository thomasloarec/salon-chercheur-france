
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
        .order('start_date', { ascending: true });

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
          .order('start_date', { ascending: true });
      }

      // Filtre « à partir d'aujourd'hui » par défaut (sauf si des mois sont précisés)
      if (!filters?.months || filters.months.length === 0) {
        query = query.gte('start_date', new Date().toISOString().split('T')[0]);
      }

      // Corriger le filtre Mois - un seul mois
      if (filters?.months?.length === 1) {
        const [month] = filters.months;
        const year = new Date().getFullYear();
        const { fromISO, toISO } = getMonthRange(year, month - 1);

        query = query
          .gte('start_date', fromISO)
          .lt('start_date', toISO);
      }

      // Gestion multi-mois
      if (filters?.months && filters.months.length > 1) {
        const year = new Date().getFullYear();
        
        const orString = filters.months
          .map(m => {
            const { fromISO, toISO } = getMonthRange(year, m - 1);
            return `and(start_date.gte.${fromISO},start_date.lt.${toISO})`;
          })
          .join(',');

        query = query.or(orString);
      }

      // Legacy support for old sectors filter (by name)
      if (filters?.sectors && filters.sectors.length > 0) {
        const sectorConditions = filters.sectors.map(sectorName => 
          `sector.eq.${sectorName}`
        ).join(',');
        query = query.or(sectorConditions);
      }

      if (filters?.types && filters.types.length > 0) {
        query = query.in('event_type', filters.types);
      }

      // Filtres existants conservés pour compatibilité
      if (filters?.query) {
        query = query.or(`name.ilike.%${filters.query}%,description.ilike.%${filters.query}%,tags.cs.{${filters.query}}`);
      }

      if (filters?.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }

      if (filters?.region) {
        query = query.ilike('region', `%${filters.region}%`);
      }

      if (filters?.startDate) {
        query = query.gte('start_date', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('end_date', filters.endDate);
      }

      if (filters?.minVisitors) {
        query = query.gte('estimated_visitors', filters.minVisitors);
      }

      if (filters?.maxVisitors) {
        query = query.lte('estimated_visitors', filters.maxVisitors);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }

      // Transform the data to include sectors and ensure event_type is properly typed
      const eventsWithSectors = data?.map(event => ({
        ...event,
        event_type: event.event_type as Event['event_type'],
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
