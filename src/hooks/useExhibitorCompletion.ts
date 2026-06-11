import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Livrable 1 — Lecture du score de complétion exposant.
 *
 * Lit la vue `exhibitor_completion` en UNE seule requête (`.in('exhibitor_id', ids)`)
 * — pas de N+1. La vue est `security_invoker = true` : l'utilisateur ne lit que
 * les lignes que la RLS l'autorise à voir, aucun filtrage supplémentaire requis.
 */

export type ExhibitorTier = 'bronze' | 'argent' | 'or';

export interface ExhibitorCompletion {
  exhibitor_id: string;
  profile_score: number;
  tier: ExhibitorTier | null;
  has_description: boolean;
  has_logo: boolean;
  has_website: boolean;
  has_linkedin: boolean;
  governance_confirmed: boolean;
  governance_state: string | null;
  has_upcoming_novelty: boolean;
  has_upcoming_participation: boolean;
  is_claimed: boolean;
}

export type ExhibitorCompletionMap = Record<string, ExhibitorCompletion>;

export function useExhibitorCompletion(exhibitorIds: string[]) {
  // Clé stable (tri) pour éviter les refetchs inutiles dus à l'ordre.
  const sortedIds = [...exhibitorIds].filter(Boolean).sort();

  return useQuery({
    queryKey: ['exhibitor-completion', sortedIds],
    queryFn: async (): Promise<ExhibitorCompletionMap> => {
      if (sortedIds.length === 0) return {};

      const { data, error } = await supabase.rpc('get_exhibitor_completion', {
        ids: sortedIds,
      });

      if (error) throw error;

      const map: ExhibitorCompletionMap = {};
      for (const row of data ?? []) {
        if (!row.exhibitor_id) continue;
        map[row.exhibitor_id] = {
          exhibitor_id: row.exhibitor_id,
          profile_score: row.profile_score ?? 0,
          tier: (row.tier as ExhibitorTier | null) ?? null,
          has_description: row.has_description ?? false,
          has_logo: row.has_logo ?? false,
          has_website: row.has_website ?? false,
          has_linkedin: row.has_linkedin ?? false,
          governance_confirmed: row.governance_confirmed ?? false,
          governance_state: row.governance_state ?? null,
          has_upcoming_novelty: row.has_upcoming_novelty ?? false,
          has_upcoming_participation: row.has_upcoming_participation ?? false,
          is_claimed: row.is_claimed ?? false,
        };
      }
      return map;
    },
    enabled: sortedIds.length > 0,
    staleTime: 30_000,
  });
}
