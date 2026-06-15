import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Renvoie une Map<event_id, nb d'entreprises distinctes du CRM qui exposent>.
 *
 * - Une seule requête réseau pour toute la page : toutes les `EventCard`
 *   partagent la même `queryKey` → React Query déduplique.
 * - Vide pour anon / user sans CRM → aucun badge par construction.
 *
 * Confidentialité : la RLS de `crm_company_event_matches`
 * (`user_id = auth.uid()`, rôle `authenticated`) borne déjà l'accès ; pas de
 * `.eq('user_id', …)` nécessaire et aucun contournement RLS (anon key uniquement).
 *
 * Cohérence avec la page Radar CRM : `RadarCrmResults.tsx` lit les matches
 * SANS filtre `match_status` ni `needs_review`. On reproduit ce comportement
 * à l'identique pour que le compteur du badge corresponde au nombre affiché
 * à l'ouverture de l'événement.
 */
export function useCrmEventMatches() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['crm-event-matches', userId],
    enabled: !!userId, // ne déclenche rien si déconnecté
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('crm_company_event_matches')
        .select('event_id, crm_company_id');

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
