import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLatestCrmImportCompanyIds } from './useLatestCrmImportCompanyIds';

/**
 * Renvoie une Map<event_id, nb d'entreprises distinctes du CRM qui exposent>.
 *
 * Portée alignée sur le widget event (`useEventCrmMatches`) : on ne compte que
 * les `crm_company_id` du DERNIER import terminé (via `useLatestCrmImportCompanyIds`).
 * Sans ça, le badge lisait toute la table → sur-comptage entre imports
 * (une même entreprise réimportée = nouveau `crm_company_id` comptée 2×).
 *
 * - Une seule requête réseau pour toute la page : toutes les `EventCard`
 *   partagent la même `queryKey` → React Query déduplique.
 * - Vide pour anon / user sans import → aucun badge par construction.
 *
 * Confidentialité : la RLS de `crm_company_event_matches`
 * (`user_id = auth.uid()`, rôle `authenticated`) borne déjà l'accès.
 */
export function useCrmEventMatches() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: companyIds, isSuccess } = useLatestCrmImportCompanyIds();

  return useQuery({
    queryKey: ['crm-event-matches', userId, companyIds],
    enabled: !!userId && isSuccess,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, number>> => {
      const ids = companyIds ?? [];
      if (ids.length === 0) return new Map<string, number>();

      // Restreint au dernier import = même portée que le widget event.
      const { data, error } = await supabase
        .from('crm_company_event_matches')
        .select('event_id, crm_company_id')
        .in('crm_company_id', ids);

      if (error) throw error;

      // COUNT(DISTINCT crm_company_id) par event → on compte des ENTREPRISES.
      const byEvent = new Map<string, Set<string>>();
      for (const row of data ?? []) {
        if (!row.event_id || !row.crm_company_id) continue;
        if (!byEvent.has(row.event_id)) byEvent.set(row.event_id, new Set());
        byEvent.get(row.event_id)!.add(row.crm_company_id);
      }

      const counts = new Map<string, number>();
      byEvent.forEach((set, eventId) => counts.set(eventId, set.size));
      return counts;
    },
  });
}
