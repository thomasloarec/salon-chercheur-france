import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lot 6 — Navigation par catégories de la section exposants.
 *
 * Ces hooks consomment UNIQUEMENT les deux RPC publiques en lecture seule.
 * Les tables event_profiles / taxonomy_categories / exhibitor_categories
 * restent réservées aux admins et ne sont jamais requêtées ici.
 */

export interface EventCategoryRow {
  /** null = ligne des exposants rattachés à aucune catégorie */
  category_id: string | null;
  label: string;
  slug: string;
  exhibitor_count: number;
  example_names: string[] | null;
}

export interface CategoryExhibitorRow {
  id_exposant: string;
  display_name: string;
  logo_url: string | null;
  website: string | null;
  stand: string | null;
  public_slug: string | null;
  seo_indexable: boolean | null;
  is_verified: boolean | null;
  total_count: number;
}

/** Borne serveur : p_limit est plafonné à 50 côté SQL. */
export const CATEGORY_PAGE_SIZE = 50;

export function useEventCategories(eventId?: string | null) {
  return useQuery({
    queryKey: ['event-public-categories', eventId],
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EventCategoryRow[]> => {
      const { data, error } = await supabase.rpc('get_public_event_categories', {
        p_event_id: eventId as string,
      });
      if (error) throw error;
      return (data || []) as EventCategoryRow[];
    },
  });
}

export function useCategoryExhibitors(
  eventId: string | null | undefined,
  categoryIds: string[],
  includeUncategorized: boolean,
  offset = 0,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      'event-category-exhibitors',
      eventId,
      [...categoryIds].sort().join(','),
      includeUncategorized,
      offset,
    ],
    enabled: !!eventId && enabled && (categoryIds.length > 0 || includeUncategorized),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: CategoryExhibitorRow[]; total: number }> => {
      const { data, error } = await supabase.rpc(
        'get_public_event_exhibitors_by_category',
        {
          p_event_id: eventId as string,
          p_category_ids: categoryIds,
          p_include_uncategorized: includeUncategorized,
          p_limit: CATEGORY_PAGE_SIZE,
          p_offset: offset,
        },
      );
      if (error) throw error;
      const rows = (data || []) as CategoryExhibitorRow[];
      return { rows, total: rows[0]?.total_count ?? 0 };
    },
  });
}
