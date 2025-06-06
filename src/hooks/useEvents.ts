
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Event, SearchFilters } from '@/types/event';

export const useEvents = (filters?: SearchFilters) => {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*')
        .eq('is_b2b', true)
        .order('start_date', { ascending: true });

      // Apply filters
      if (filters?.query) {
        query = query.or(`name.ilike.%${filters.query}%,description.ilike.%${filters.query}%,tags.cs.{${filters.query}}`);
      }

      if (filters?.sector) {
        query = query.eq('sector', filters.sector);
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
