import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UrlFilters } from "@/lib/useUrlFilters";

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

  // Utiliser l'edge function existante avec les nouveaux filtres
  const params: Record<string, string> = {
    page: page.toString(),
    pageSize: pageSize.toString(),
    sort: 'awaited' // tri par popularité
  };

  if (sector) params.sector = sector;
  if (type) params.type = type;
  if (month) params.month = month;
  if (region) params.region = region;

  const { data, error } = await supabase.functions.invoke('novelties-list', {
    body: params
  });

  if (error) {
    console.warn("[novelties] edge function error:", error);
    throw error;
  }

  return data || { data: [], total: 0, page, pageSize };
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
    queryKey: ["novelties:list", filters, page, pageSize], // ← clé sensible aux filtres
    queryFn: () => fetchNovelties(filters, page, pageSize),
    staleTime: 30_000,
    enabled,
  });
}