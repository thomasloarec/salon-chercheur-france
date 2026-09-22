import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MarketIntelStatut =
  | 'ok'
  | 'evenement_sans_exposants'
  | 'aucun_exposant_reference'
  | 'analyse_en_preparation'
  | 'salon_introuvable';

export interface MarketIntelComparable {
  nom: string;
  ville: string | null;
  date_debut: string | null;
  slug: string | null;
  exposants_partages: number;
  proximite?: 'très forte' | 'forte' | 'moyenne' | 'faible';
  score?: number;
}

export interface MarketIntelSegment {
  segment: string;
  secteur: string;
  nb?: number;
  pct?: number;
  pct_salon?: number;
  pct_comparables?: number;
  entreprises_absentes?: number;
}

export interface MarketIntel {
  statut: MarketIntelStatut;
  analyse_partielle?: boolean;
  liste?: {
    fournie: boolean;
    source_organisateur?: boolean;
    confirmee: boolean;
    en_attente: boolean;
  };
  synthese?: {
    nb_exposants: number;
    nb_segments?: number;
    nb_comparables?: number;
    vivier_absent?: number | null;
    secteur_dominant?: string | null;
    confiance?: 'haute' | 'moyenne' | 'faible';
  };
  points_forts?: MarketIntelSegment[];
  comparables?: MarketIntelComparable[];
  autres_editions?: MarketIntelComparable[];
  angles_morts?: MarketIntelSegment[];
  angles_morts_total?: number;
  angles_morts_masques?: number;
  retention?: { disponible: boolean; raison?: string };
  genere_le?: string;
}

export function useMarketIntel(eventId?: string, enabled = true) {
  return useQuery({
    queryKey: ['market-intel', eventId],
    queryFn: async (): Promise<MarketIntel | null> => {
      if (!eventId) return null;
      const { data, error } = await supabase.rpc('get_market_intel' as any, {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!eventId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
