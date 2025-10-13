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
      exhibitors ( id, name, slug, logo_url ),
      novelty_stats ( route_users_count, popularity_score )
    `)
    .eq("events.visible", true)
    .eq("status", "published")  // ✅ Lowercase status after normalization
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
    console.error('❌ useNoveltiesList fetch error:', error);
    return { data: [], total: 0, page, pageSize };
  }

  console.log('✅ useNoveltiesList fetched:', data?.length || 0, 'novelties');

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
    } : undefined,
    novelty_stats: row.novelty_stats || undefined
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

  // ✅ RÈGLE MÉTIER : Garder uniquement 1 nouveauté par événement (la plus populaire)
  const eventMap = new Map<string, NoveltyRow>();
  
  for (const novelty of filteredResults) {
    const eventId = novelty.event_id;
    const existing = eventMap.get(eventId);
    
    if (!existing) {
      // Premier pour cet événement
      eventMap.set(eventId, novelty);
    } else {
      // Comparer la popularité pour garder la meilleure
      const currentScore = novelty.novelty_stats?.popularity_score || novelty.novelty_stats?.route_users_count || 0;
      const existingScore = existing.novelty_stats?.popularity_score || existing.novelty_stats?.route_users_count || 0;
      
      if (currentScore > existingScore) {
        eventMap.set(eventId, novelty);
      } else if (currentScore === existingScore) {
        // À score égal, prendre la plus récente
        if (new Date(novelty.created_at) > new Date(existing.created_at)) {
          eventMap.set(eventId, novelty);
        }
      }
    }
  }

  const uniqueByEvent = Array.from(eventMap.values());
  
  // Tri final par popularité puis date
  uniqueByEvent.sort((a, b) => {
    const scoreA = a.novelty_stats?.popularity_score || a.novelty_stats?.route_users_count || 0;
    const scoreB = b.novelty_stats?.popularity_score || b.novelty_stats?.route_users_count || 0;
    
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  console.log('✅ useNoveltiesList after grouping:', uniqueByEvent.length, 'novelties (1 per event)');
  
  return {
    data: uniqueByEvent,
    total: uniqueByEvent.length,
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