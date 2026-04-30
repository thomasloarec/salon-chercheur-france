import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type DuplicateMatchLevel =
  | 'to_watch'
  | 'potential_duplicate'
  | 'probable_duplicate';

export type DuplicateStatus =
  | 'none'
  | 'to_watch'
  | 'potential_duplicate'
  | 'probable_duplicate'
  | 'confirmed_distinct'
  | 'confirmed_duplicate';

export interface DuplicateCandidateRow {
  id: string;
  source_kind: 'event' | 'staging';
  source_id: string;
  source_id_event: string | null;
  matched_kind: 'event' | 'staging';
  matched_id: string;
  matched_id_event: string | null;
  score: number;
  match_level: DuplicateMatchLevel;
  reasons: {
    same_dates?: boolean;
    same_url?: boolean;
    same_domain?: boolean;
    same_city?: boolean;
    name_similarity?: number;
  };
  resolution: 'confirmed_distinct' | 'confirmed_duplicate' | null;
  resolved_at: string | null;
  created_at: string;
}

export interface MatchedEventInfo {
  id: string;
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  url_site_officiel: string | null;
  visible: boolean | null;
  slug: string | null;
}

/**
 * Récupère tous les candidats doublons non résolus, hydratés avec les infos
 * de l'événement matché (depuis events).
 */
export function useEventDuplicates() {
  return useQuery({
    queryKey: ['event-duplicate-candidates'],
    queryFn: async () => {
      const { data: candidates, error } = await supabase
        .from('event_duplicate_candidates')
        .select('*')
        .is('resolution', null)
        .order('score', { ascending: false });
      if (error) throw error;

      const matchedIds = Array.from(
        new Set((candidates ?? []).map((c) => c.matched_id))
      );

      let matchedMap = new Map<string, MatchedEventInfo>();
      if (matchedIds.length > 0) {
        const { data: events } = await supabase
          .from('events')
          .select('id, nom_event, date_debut, date_fin, ville, url_site_officiel, visible, slug')
          .in('id', matchedIds);
        for (const e of events ?? []) {
          matchedMap.set(e.id, e as MatchedEventInfo);
        }
      }

      // Grouper par source
      const bySource = new Map<
        string,
        { source_kind: 'event' | 'staging'; source_id: string; rows: (DuplicateCandidateRow & { matched: MatchedEventInfo | null })[] }
      >();
      for (const c of (candidates ?? []) as DuplicateCandidateRow[]) {
        const key = `${c.source_kind}:${c.source_id}`;
        if (!bySource.has(key)) {
          bySource.set(key, { source_kind: c.source_kind, source_id: c.source_id, rows: [] });
        }
        bySource.get(key)!.rows.push({
          ...c,
          matched: matchedMap.get(c.matched_id) ?? null,
        });
      }
      return Array.from(bySource.values());
    },
    staleTime: 30_000,
  });
}

export function useRebuildDuplicates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('events-duplicate-scan', {
        body: { rebuild: true, only_future: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Recalcul terminé',
        description: `${data?.scanned ?? 0} événements analysés.`,
      });
      qc.invalidateQueries({ queryKey: ['event-duplicate-candidates'] });
      qc.invalidateQueries({ queryKey: ['events-import-pending-staging'] });
      qc.invalidateQueries({ queryKey: ['events-hidden'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });
}

export function useResolveDuplicate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: {
      source_kind: 'event' | 'staging';
      source_id: string;
      matched_kind: 'event' | 'staging';
      matched_id: string;
      resolution: 'confirmed_distinct' | 'confirmed_duplicate';
    }) => {
      const { data, error } = await supabase.functions.invoke('events-duplicate-scan', {
        body: { mark: params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, params) => {
      toast({
        title:
          params.resolution === 'confirmed_distinct'
            ? 'Marqué comme événement distinct'
            : 'Marqué comme doublon confirmé',
      });
      qc.invalidateQueries({ queryKey: ['event-duplicate-candidates'] });
      qc.invalidateQueries({ queryKey: ['events-import-pending-staging'] });
      qc.invalidateQueries({ queryKey: ['events-hidden'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });
}