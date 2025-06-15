
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event, SearchFilters } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';

interface UseEventsParams {
  sectors?: string[];
  types?: string[];
  months?: number[];
  city?: string;
  query?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
  minVisitors?: number;
  maxVisitors?: number;
}

export const useEvents = (filters?: SearchFilters) => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@salonspro.com';

  return useQuery({
    queryKey: ['events', filters, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*');

      if (!isAdmin) {
        query = query.eq('visible', true);
      }

      query = query
        .eq('is_b2b', true)
        .gte('start_date', new Date().toISOString().split('T')[0]) // Exclure les événements passés
        .order('start_date', { ascending: true });

      // Filtres obligatoires et nouveaux
      if (filters?.sectors && filters.sectors.length > 0) {
        query = query.in('sector', filters.sectors);
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

      return data as Event[];
    },
  });
};

export const useSectors = () => {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching sectors:', error);
        throw error;
      }

      return data;
    },
  });
};
