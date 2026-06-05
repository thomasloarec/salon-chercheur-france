import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReconSideProfile {
  identity_id: string | null;
  public_slug: string | null;
  canonical_name: string | null;
  source_type: string | null;
  is_active: boolean | null;
  exhibitor_id: string | null;
  exhibitor_name: string | null;
  exhibitor_website: string | null;
  owner_present: boolean | null;
  legacy_exposant_id: string | null;
  legacy_name: string | null;
  legacy_website: string | null;
  normalized_domain: string | null;
  airtable_real_id: string | null;
  uuid_mirror_id: string | null;
  participations_count: number | null;
  published_novelties_count: number | null;
  leads_count: number | null;
  active_team_count: number | null;
  crm_matches_count: number | null;
  has_hard_deps: boolean | null;
  dep_score: number | null;
}

export interface ReconPair {
  pair_key: string;
  pair_identity_ids: string[];
  group_key: string;
  status: string;
  category: string;
  score: number;
  confidence: string;
  same_domain: boolean;
  website_conflict: boolean;
  recommended_keep_slug: string | null;
  recommended_deactivate_slug: string | null;
  plan_text: string | null;
  reasons: Record<string, unknown> | null;
  side_keep: ReconSideProfile | null;
  side_deactivate: ReconSideProfile | null;
}

export interface ReconSummary {
  pairs_analyzed: number;
  unique_identities: number;
  distinct_group_keys: number;
  auto_reconcilable: number;
  manual_review: number;
  dangerous: number;
  likely_false_positive: number;
}

export function useReconciliationSummary(minScore = 60) {
  return useQuery({
    queryKey: ['recon-preview-summary', minScore],
    queryFn: async (): Promise<ReconSummary | null> => {
      const { data, error } = await supabase.rpc(
        'admin_preview_exhibitor_identity_reconciliation_summary',
        { p_min_score: minScore },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as ReconSummary) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useReconciliationPairs(minScore = 60) {
  return useQuery({
    queryKey: ['recon-preview-pairs', minScore],
    queryFn: async (): Promise<ReconPair[]> => {
      const { data, error } = await supabase.rpc(
        'admin_preview_exhibitor_identity_reconciliation',
        { p_min_score: minScore },
      );
      if (error) throw error;
      return ((data ?? []) as unknown[]).map((r) => {
        const row = r as Record<string, unknown>;
        return {
          ...row,
          side_keep: (row.side_keep as ReconSideProfile) ?? null,
          side_deactivate: (row.side_deactivate as ReconSideProfile) ?? null,
          reasons: (row.reasons as Record<string, unknown>) ?? null,
        } as ReconPair;
      });
    },
    staleTime: 60_000,
  });
}
