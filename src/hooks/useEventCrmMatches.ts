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
 * - Utilise uniquement les tables protégées par RLS (`user_id = auth.uid()`).
 *   Aucun service_role, aucun contournement RLS.
 *
 * Règle "dernier import" :
 * - On récupère le dernier import (created_at desc).
 * - Si ce dernier import est `uploaded`/`processing` -> état "processing".
 * - Si `failed` -> état "failed".
 * - Si `completed` -> on cherche les matches sur cet import uniquement
 *   (pas de matches issus d'anciens imports), filtrés sur l'événement courant.
 */

export type EventCrmMatch = {
  crmCompanyId: string;
  crmCompanyName: string;
  exhibitorName: string | null;
  stand: string | null;
  needsReview: boolean;
};

export type EventCrmMatchesResult =
  | { status: 'no_imports'; matches: []; total: 0; importId: null }
  | { status: 'processing'; matches: []; total: 0; importId: string }
  | { status: 'failed'; matches: []; total: 0; importId: string }
  | { status: 'no_matches'; matches: []; total: 0; importId: string }
  | { status: 'has_matches'; matches: EventCrmMatch[]; total: number; importId: string };

type ImportRow = { id: string; status: string; created_at: string };
type CompanyRow = { id: string; company_name: string };
type MatchRow = {
  crm_company_id: string;
  id_exposant: string;
  needs_review: boolean | null;
};
type ViewRow = {
  id_exposant: string;
  nom_exposant: string | null;
  stand_exposants_list: string | null;
};

export function useEventCrmMatches(
  eventId: string | undefined,
  options?: { enabled?: boolean },
) {
  const enabled = (options?.enabled ?? true) && !!eventId;

  return useQuery<EventCrmMatchesResult>({
    queryKey: ['event-crm-matches', eventId],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EventCrmMatchesResult> => {
      // 1. Dernier import de l'utilisateur (RLS: user_id = auth.uid())
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

      // 2. Entreprises CRM du dernier import terminé
      const { data: comps } = await supabase
        .from('crm_companies')
        .select('id, company_name')
        .eq('import_id', latest.id);

      const companies = (comps ?? []) as CompanyRow[];
      if (companies.length === 0) {
        return { status: 'no_matches', matches: [], total: 0, importId: latest.id };
      }
      const companyMap = new Map(companies.map((c) => [c.id, c]));

      // 3. Matches sur CET événement uniquement, limités à cet import
      const { data: mts } = await supabase
        .from('crm_company_event_matches')
        .select('crm_company_id, id_exposant, needs_review')
        .eq('event_id', eventId as string)
        .in('crm_company_id', companies.map((c) => c.id));

      const matches = (mts ?? []) as MatchRow[];
      if (matches.length === 0) {
        return { status: 'no_matches', matches: [], total: 0, importId: latest.id };
      }

      // 4. Détails exposant (nom / stand) via la vue publique
      const exposantIds = Array.from(new Set(matches.map((m) => m.id_exposant)));
      const { data: vrows } = await supabase
        .from('crm_radar_participations_view')
        .select('id_exposant, nom_exposant, stand_exposants_list')
        .eq('event_id', eventId as string)
        .in('id_exposant', exposantIds);

      const viewMap = new Map(
        ((vrows ?? []) as ViewRow[]).map((v) => [v.id_exposant, v]),
      );

      // 5. Déduplication par crm_company_id
      const dedup = new Map<string, EventCrmMatch>();
      for (const m of matches) {
        const company = companyMap.get(m.crm_company_id);
        if (!company) continue;
        if (dedup.has(m.crm_company_id)) continue;
        const v = viewMap.get(m.id_exposant);
        dedup.set(m.crm_company_id, {
          crmCompanyId: m.crm_company_id,
          crmCompanyName: company.company_name,
          exhibitorName: v?.nom_exposant ?? null,
          stand: v?.stand_exposants_list ?? null,
          needsReview: m.needs_review === true,
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