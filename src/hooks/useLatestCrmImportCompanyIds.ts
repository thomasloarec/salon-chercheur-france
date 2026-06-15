import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Ids des `crm_companies` du DERNIER import terminé de l'utilisateur courant.
 *
 * Source de portée UNIQUE, partagée par le widget event (`useEventCrmMatches`)
 * ET le badge carte (`useCrmEventMatches`) → impossible que les deux divergent
 * à nouveau sur la définition de « dernier import ».
 *
 * Confidentialité : la RLS (`user_id = auth.uid()`) borne déjà `crm_imports`
 * et `crm_companies` ; aucun contournement RLS.
 */
export function useLatestCrmImportCompanyIds() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['crm-latest-import-companies', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data: latest, error: e1 } = await supabase
        .from('crm_imports')
        .select('id')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      if (!latest) return [];

      const { data: companies, error: e2 } = await supabase
        .from('crm_companies')
        .select('id')
        .eq('import_id', latest.id);
      if (e2) throw e2;
      return (companies ?? []).map((c) => c.id as string);
    },
  });
}
