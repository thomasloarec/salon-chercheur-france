import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook spécifique à la page détail événement.
 *
 * Détermine, pour l'utilisateur connecté, si des entreprises de son dernier
 * import CRM exposent sur l'événement courant.
 *
 * Confidentialité :
 * - Aucune requête n'est exécutée si `enabled` est false (utilisateur non connecté
 *   ou eventId manquant). L'appelant DOIT passer `enabled: !!user && !!eventId`.
 * - Les NOMS des entreprises/exposants ne sont JAMAIS lus en direct : ils
 *   proviennent de la RPC server-side dédiée et gatée `get_my_radar_event_matches`,
 *   qui ne renvoie en verrouillé QUE `has_matches` (booléen) — ni compteur, ni
 *   identités (`companies: []`). Le verrou d'entitlement est appliqué côté serveur.
 *
 * Règle "dernier import" :
 * - On récupère le dernier import (created_at desc) UNIQUEMENT pour distinguer
 *   les états de cycle de vie (no_imports / processing / failed). Cette requête
 *   ne lit que `status` (pas de noms).
 * - Si `completed` -> on appelle la RPC gatée `get_my_radar_event_matches`.
 */

export type EventCrmMatch = {
  crmCompanyId: string;
  crmCompanyName: string;
  idExposant: string;
  exhibitorName: string | null;
  stand: string | null;
  website: string | null;
  needsReview: boolean;
};

export type EventCrmMatchesResult =
  | { status: 'no_imports'; matches: []; total: 0; importId: null }
  | { status: 'processing'; matches: []; total: 0; importId: string }
  | { status: 'failed'; matches: []; total: 0; importId: string }
  | { status: 'no_matches'; matches: []; total: 0; importId: string }
  | { status: 'has_matches'; matches: EventCrmMatch[]; total: number; importId: string }
  | { status: 'locked'; matches: []; total: 0; importId: string };

type ImportRow = { id: string; status: string; created_at: string };

/**
 * Forme renvoyée par la RPC server-side gatée `get_my_radar_event_matches`.
 * Typée localement car la RPC est `Json` dans les types Supabase générés.
 * En verrouillé : `has_access=false`, `companies=[]`, seul `has_matches` est exploitable.
 */
interface EventMatchCompany {
  crm_company_id: string;
  company_name: string | null;
  website_raw: string | null;
  normalized_domain: string | null;
  id_exposant: string | null;
  nom_exposant: string | null;
  stand_exposants_list: string | null;
  needs_review: boolean | null;
  name_similarity: number | null;
}
interface EventMatchView {
  has_access: boolean;
  has_matches: boolean;
  companies: EventMatchCompany[];
}

export function useEventCrmMatches(
  eventId: string | undefined,
  options?: { enabled?: boolean; userId?: string | null },
) {
  const enabled = (options?.enabled ?? true) && !!eventId;

  return useQuery<EventCrmMatchesResult>({
    // userId fait partie de la clé pour isoler le cache entre utilisateurs
    // (évite toute fuite de matches CRM d'un utilisateur A vers un utilisateur B
    //  dans le même onglet, le cache React Query n'étant pas vidé à la déconnexion).
    queryKey: ['event-crm-matches', eventId, options?.userId ?? null],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EventCrmMatchesResult> => {
      // 1. Dernier import de l'utilisateur (RLS: user_id = auth.uid()).
      //    Sert uniquement à distinguer no_imports / processing / failed.
      const { data: importsData } = await supabase
        .from('crm_imports')
        .select('id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      const latest = (importsData ?? [])[0] as ImportRow | undefined;
      if (!latest) {
        return { status: 'no_imports', matches: [], total: 0, importId: null };
      }

      if (latest.status === 'uploaded' || latest.status === 'processing') {
        return { status: 'processing', matches: [], total: 0, importId: latest.id };
      }
      if (latest.status === 'failed') {
        return { status: 'failed', matches: [], total: 0, importId: latest.id };
      }

      // 2. RPC dédiée gatée côté serveur (entitlement appliqué dans la RPC).
      //    En verrouillé, elle ne renvoie ni compteur ni noms — seulement
      //    `has_matches`. En cas d'erreur, on PROPAGE pour un état visible.
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_radar_event_matches', {
        p_event_id: eventId as string,
      });
      if (rpcError) {
        console.error('[RadarCRM] get_my_radar_event_matches failed:', rpcError);
        throw rpcError;
      }

      const view = (rpcData as unknown as EventMatchView) ?? null;
      if (!view || !view.has_matches) {
        return { status: 'no_matches', matches: [], total: 0, importId: latest.id };
      }

      // Compte verrouillé : `has_matches=true` mais aucun nom ni compteur.
      if (!view.has_access) {
        return { status: 'locked', matches: [], total: 0, importId: latest.id };
      }

      // Accès complet : on mappe les entreprises vers la forme du widget,
      // dédupliquées par crm_company_id.
      const dedup = new Map<string, EventCrmMatch>();
      for (const c of view.companies ?? []) {
        if (!c.crm_company_id || dedup.has(c.crm_company_id)) continue;
        dedup.set(c.crm_company_id, {
          crmCompanyId: c.crm_company_id,
          crmCompanyName: c.company_name ?? '',
          idExposant: c.id_exposant ?? '',
          exhibitorName: c.nom_exposant ?? null,
          stand: c.stand_exposants_list ?? null,
          website: c.website_raw ?? null,
          needsReview: c.needs_review === true,
        });
      }

      const list = Array.from(dedup.values());
      if (list.length === 0) {
        return { status: 'no_matches', matches: [], total: 0, importId: latest.id };
      }

      return {
        status: 'has_matches',
        matches: list,
        total: list.length,
        importId: latest.id,
      };
    },
  });
}