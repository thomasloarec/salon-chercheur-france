import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PublicStats {
  salons: number;
  exposants: number;
}

/**
 * Compteurs publics de la home : nombre de salons visibles (hors test)
 * et nombre de fiches exposants. Deux requêtes de comptage seulement,
 * lecture anonyme autorisée par les RLS existantes.
 */
export const usePublicStats = () => {
  return useQuery({
    queryKey: ['public-stats'],
    queryFn: async (): Promise<PublicStats> => {
      const [salonsRes, exposantsRes] = await Promise.all([
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('visible', true)
          .eq('is_test', false),
        supabase
          .from('exposants')
          .select('*', { count: 'exact', head: true }),
      ]);

      if (salonsRes.error) console.error('[public-stats] salons:', salonsRes.error);
      if (exposantsRes.error) console.error('[public-stats] exposants:', exposantsRes.error);

      return {
        salons: salonsRes.count ?? 0,
        exposants: exposantsRes.count ?? 0,
      };
    },
    staleTime: 300_000, // 5 min
  });
};