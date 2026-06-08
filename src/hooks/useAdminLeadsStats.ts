import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminLeadsByNovelty {
  novelty_id: string;
  novelty_title: string | null;
  novelty_slug: string | null;
  exhibitor_name: string | null;
  event_name: string | null;
  leads_total: number;
  leads_rdv: number;
  leads_brochure: number;
}

export interface AdminLeadsStats {
  totals: {
    total_leads: number;
    total_rdv: number;
    total_brochure: number;
  };
  by_novelty: AdminLeadsByNovelty[];
}

export const useAdminLeadsStats = () => {
  return useQuery({
    queryKey: ['admin-leads-stats'],
    queryFn: async (): Promise<AdminLeadsStats> => {
      const { data, error } = await supabase.rpc('get_admin_leads_stats' as any);
      if (error) throw error;
      return data as unknown as AdminLeadsStats;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};
