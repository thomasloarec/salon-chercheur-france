import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UrlFilters } from '@/lib/useUrlFilters';
import type { CanonicalEvent } from '@/types/lotexpo';
import {
  normalizeEventRow,
  matchesMonth,
  matchesSectorLabels,
  matchesType,
  isOngoingOrUpcoming,
} from '@/lib/normalizeEvent';
import { sectorSlugToDbLabels, typeSlugToDbValue } from '@/lib/taxonomy';
import { regionSlugFromPostal } from '@/lib/postalToRegion';

export interface EventsPage {
  data: CanonicalEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

interface UseInfiniteEventsParams {
  filters: UrlFilters;
  pageSize?: number;
  enabled?: boolean;
}

function matchesRegion(ev: CanonicalEvent, wantedSlug: string | null): boolean {
  if (!wantedSlug) return true;
  const slug = regionSlugFromPostal(ev.postal_code);
  return slug === wantedSlug;
}

async function fetchAllFilteredEvents(filters: UrlFilters): Promise<CanonicalEvent[]> {
  const { sectors, type } = filters;

  let q = supabase
    .from("events")
    .select("*")
    .eq("visible", true)
    .order("date_debut", { ascending: true });

  // TYPE via type_event
  const dbType = typeSlugToDbValue(type);
  if (dbType) q = q.eq("type_event", dbType);

  // SECTEUR via jsonb contains (multi-sélection)
  if (sectors.length > 0) {
    const allLabels = sectors.flatMap(s => sectorSlugToDbLabels(s));
    
    if (allLabels.length === 1) {
      q = q.contains("secteur", [allLabels[0]]);
    } else if (allLabels.length > 1) {
      const parts = allLabels.map(l => `secteur.cs.${JSON.stringify([l])}`);
      q = q.or(parts.join(","));
    }
  }

  const { data, error } = await q;
  
  if (error) {
    console.warn("[events] server filters failed, attempting fallback:", error.message);
    // Fallback: fetch all visible events
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("events")
      .select("*")
      .eq("visible", true)
      .order("date_debut", { ascending: true });
    
    if (fallbackError) throw fallbackError;
    
    const normalized = (Array.isArray(fallbackData) ? fallbackData : []).map(normalizeEventRow);
    
    // Apply all filters client-side
    const byType = normalized.filter(ev => matchesType(ev, typeSlugToDbValue(filters.type)));
    const bySector = filters.sectors.length > 0
      ? byType.filter(ev => {
          const allLabels = filters.sectors.flatMap(s => sectorSlugToDbLabels(s));
          return matchesSectorLabels(ev, allLabels.length > 0 ? allLabels : null);
        })
      : byType;
    const byMonth = bySector.filter(ev => matchesMonth(ev, filters.month));
    const byDate = byMonth.filter(ev => isOngoingOrUpcoming(ev));
    const byRegion = byDate.filter(ev => matchesRegion(ev, filters.region));
    
    return byRegion;
  }
  
  const normalized = (Array.isArray(data) ? data : []).map(normalizeEventRow);
  
  // Apply remaining filters client-side
  const byMonth = normalized.filter(ev => matchesMonth(ev, filters.month));
  const byDate = byMonth.filter(ev => isOngoingOrUpcoming(ev));
  const byRegion = byDate.filter(ev => matchesRegion(ev, filters.region));
  
  return byRegion;
}

export function useInfiniteEvents(params: UseInfiniteEventsParams) {
  const { filters, pageSize = 24, enabled = true } = params;

  return useInfiniteQuery({
    queryKey: [
      'events:infinite',
      filters.sectors.join(',') || 'all',
      filters.type ?? 'all',
      filters.month ?? 'all',
      filters.region ?? 'all',
      pageSize
    ],
    queryFn: async ({ pageParam = 1 }): Promise<EventsPage> => {
      console.log('🔍 useInfiniteEvents fetch starting:', {
        filters,
        page: pageParam,
        pageSize
      });

      // Fetch all filtered events (we cache this with React Query)
      const allEvents = await fetchAllFilteredEvents(filters);

      // Apply pagination
      const offset = (pageParam - 1) * pageSize;
      const paginatedData = allEvents.slice(offset, offset + pageSize);
      const hasNextPage = offset + paginatedData.length < allEvents.length;

      console.log('✅ useInfiniteEvents result:', {
        total: allEvents.length,
        page: pageParam,
        returned: paginatedData.length,
        hasNextPage
      });

      return {
        data: paginatedData,
        total: allEvents.length,
        page: pageParam,
        pageSize,
        hasNextPage
      };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNextPage) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled,
    staleTime: 60_000,
  });
}
