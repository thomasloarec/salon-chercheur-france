import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type EmailBlacklistRow = {
  email_normalized: string;
  source: string;
  origine_libelle: string;
  auto_desinscrit: boolean;
  reason: string;
  note: string | null;
  blackliste_le: string;
  derniere_desinscription: string | null;
  nb_clics: number;
  company_name: string | null;
  event_name: string | null;
  sequence_type: string | null;
};

export function useEmailBlacklist() {
  return useQuery({
    queryKey: ['email-blacklist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_admin_desinscriptions' as any)
        .select('*')
        .order('blackliste_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmailBlacklistRow[];
    },
  });
}