
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event, SearchFilters } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';

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

      if (!isAdmin) {
        query = query.eq('visible', true);
      }

      query = query
        .eq('is_b2b', true)
        .gte('start_date', new Date().toISOString().split('T')[0]) // Exclure les événements passés
        .order('start_date', { ascending: true });

      // Filtres secteurs - utiliser les noms des secteurs pour le filtrage
      if (filters?.sectors && filters.sectors.length > 0) {
        // Pour les filtres de secteurs, on filtre à la fois sur l'ancien champ "sector" 
        // et sur les nouveaux secteurs liés via event_sectors
        const sectorConditions = filters.sectors.map(sectorName => 
          `sector.eq.${sectorName}`
        ).join(',');
        query = query.or(sectorConditions);
      }

      if (filters?.types && filters.types.length > 0) {
        query = query.in('event_type', filters.types);
      }

      if (filters?.months && filters.months.length > 0) {
        // Utiliser la fonction PostgreSQL extract pour filtrer par mois
        const monthsCondition = `(${filters.months.join(',')})`;
        query = query.filter('extract(month from start_date)::int', 'in', monthsCondition);
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
