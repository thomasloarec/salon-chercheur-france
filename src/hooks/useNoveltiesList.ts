import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UrlFilters } from "@/lib/useUrlFilters";
import { sectorSlugToDbLabels, typeSlugToDbValue } from "@/lib/taxonomy";
import { regionSlugFromPostal } from "@/lib/postalToRegion";
import { isOngoingOrUpcoming } from "@/lib/normalizeEvent";

export interface NoveltyRow {
  id: string;
  title: string;
  type: string;
  media_urls: string[];
  created_at: string;
  exhibitor_id: string;
  event_id: string;
  exhibitors: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
  };
  events?: {
    id: string;
    nom_event: string;
    slug: string;
    ville: string;
    date_debut?: string;
    type_event?: string;
    code_postal?: string;
  };
  novelty_stats?: {
    route_users_count: number;
    popularity_score: number;
  };
  in_user_route?: boolean;
}

export interface NoveltiesListResponse {
  data: NoveltyRow[];
  total: number;
  page: number;
  pageSize: number;
}


async function fetchNovelties(
  filters: UrlFilters,
  page: number = 1,
  pageSize: number = 12
): Promise<NoveltiesListResponse> {
  const { sector, type, month, region } = filters;

  let q = supabase
    .from("novelties")
    .select(`
      id, title, type, media_urls, created_at, event_id, exhibitor_id,
      events!inner (
        id, slug, nom_event, date_debut, type_event, secteur, visible, ville, code_postal
      ),
      exhibitors ( id, name, slug, logo_url )
    `)
    .eq("events.visible", true)
    .eq("status", "published")  // Only show published novelties
    .order("created_at", { ascending: false });

  const dbType = typeSlugToDbValue(type);
  if (dbType) q = q.eq("events.type_event", dbType);

  if (sector) {
    const labels = sectorSlugToDbLabels(sector);
    if (labels.length === 1) {
      q = q.contains("events.secteur", [labels[0]]);
    } else if (labels.length > 1) {
      const parts = labels.map(l => `events.secteur.cs.${JSON.stringify([l])}`);
      q = q.or(parts.join(","));
    }
  }

  const { data, error } = await q;
  if (error) {
    return { data: [], total: 0, page, pageSize };
  }

  // Map database results to NoveltyRow interface
  const results: NoveltyRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    type: row.type || '',
    media_urls: row.media_urls || [],
    created_at: row.created_at,
    exhibitor_id: row.exhibitor_id,
    event_id: row.event_id,
    exhibitors: row.exhibitors,
    events: row.events ? {
      id: row.events.id,
      nom_event: row.events.nom_event,
      slug: row.events.slug,
      ville: row.events.ville || '',
      date_debut: row.events.date_debut,
      type_event: row.events.type_event,
      code_postal: row.events.code_postal
    } : undefined
  }));

  // Filter to only show novelties from ongoing or upcoming events with client-side filters
  const filteredResults = results.filter(novelty => {
    if (!novelty.events) return false;
    
    // Check if event is ongoing/upcoming
    const event = {
      start_date: novelty.events.date_debut,
      end_date: null, // Not available in this query
    };
    if (!isOngoingOrUpcoming(event as any)) return false;
    
    // Month filter
    if (month) {
      const startDate = novelty.events.date_debut;
      if (!startDate || !startDate.includes(`-${month}-`)) return false;
    }
    
    // Region filter
    if (region) {
      const postalCode = novelty.events.code_postal;
      const eventRegion = regionSlugFromPostal(postalCode);
      if (eventRegion !== region) return false;
    }
    
    return true;
  });
  
  return {
    data: filteredResults,
    total: filteredResults.length,
    page,
    pageSize
  };
}

interface UseNoveltiesListOptions {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export function useNoveltiesList(
  filters: UrlFilters,
  options: UseNoveltiesListOptions = {}
) {
  const { page = 1, pageSize = 12, enabled = true } = options;

  return useQuery({
    queryKey: ["novelties:list", filters.sector ?? 'all', filters.type ?? 'all', filters.month ?? 'all', filters.region ?? 'all', page, pageSize], // ← clé primitive stable
    queryFn: () => fetchNovelties(filters, page, pageSize),
    staleTime: 30_000,
    enabled,
  });
}