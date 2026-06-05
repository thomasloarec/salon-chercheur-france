import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
  total_count: number;
}

export interface ReconSummary {
  pairs_analyzed: number;
  unique_identities: number;
  distinct_group_keys: number;
}

export interface ReconStatusBreakdown {
  auto_reconcilable: number;
  manual_review: number;
  dangerous: number;
  likely_false_positive: number;
}

export interface ReconPageParams {
  minScore?: number;
  status?: string | null;
  category?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export interface ReconPageResult {
  rows: ReconPair[];
  total: number;
}

/** Lightweight, fast summary (no dependency profiles). */
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
      if (!row) return null;
      return {
        pairs_analyzed: row.pairs_analyzed ?? 0,
        unique_identities: row.unique_identities ?? 0,
        distinct_group_keys: row.distinct_group_keys ?? 0,
      };
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** Heavy, on-demand status breakdown — only runs when `enabled` is true. */
export function useReconciliationStatusBreakdown(minScore = 60, enabled = false) {
  return useQuery({
    queryKey: ['recon-preview-breakdown', minScore],
    enabled,
    queryFn: async (): Promise<ReconStatusBreakdown | null> => {
      const { data, error } = await supabase.rpc(
        'admin_preview_exhibitor_identity_reconciliation_status_breakdow',
        { p_min_score: minScore },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as ReconStatusBreakdown) ?? null;
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** Server-paginated page of pairs; only the returned rows are enriched. */
export function useReconciliationPage(params: ReconPageParams, enabled = true) {
  const {
    minScore = 60,
    status = null,
    category = null,
    search = null,
    limit = 50,
    offset = 0,
  } = params;
  return useQuery({
    queryKey: ['recon-preview-page', minScore, status, category, search, limit, offset],
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
    queryFn: async (): Promise<ReconPageResult> => {
      const { data, error } = await supabase.rpc(
        'admin_preview_exhibitor_identity_reconciliation_page',
        {
          p_min_score: minScore,
          p_status: status,
          p_category: category,
          p_search: search,
          p_limit: limit,
          p_offset: offset,
        },
      );
      if (error) throw error;
      const list = (data ?? []) as unknown[];
      const rows = list.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          ...row,
          side_keep: (row.side_keep as ReconSideProfile) ?? null,
          side_deactivate: (row.side_deactivate as ReconSideProfile) ?? null,
          reasons: (row.reasons as Record<string, unknown>) ?? null,
        } as ReconPair;
      });
      const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;
      return { rows, total };
    },
  });
}
