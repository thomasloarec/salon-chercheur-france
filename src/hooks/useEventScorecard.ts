import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ScorecardCompletude {
  exposants_references: number;
  fiches_enrichies: number;
  fiches_embeddees: number;
  pct_enrichies: number;
}

export type ScorecardVisibilite =
  | { available: false }
  | { available: true; below_threshold: true }
  | {
      available: true;
      below_threshold: false;
      apparitions: number;
      requetes_secteur: number;
      requetes_sans_reponse: number;
      taux_capture_pct: number;
    };

export interface EventScorecard {
  completude: ScorecardCompletude;
  visibilite_30j: ScorecardVisibilite;
  genere_le: string;
  error?: string;
}

export function useEventScorecard(eventId?: string, enabled = true) {
  return useQuery({
    queryKey: ['event-scorecard', eventId],
    queryFn: async (): Promise<EventScorecard | { error: string } | null> => {
      if (!eventId) return null;
      const { data, error } = await supabase.rpc('get_event_scorecard' as any, {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!eventId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
