import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PremiumEntitlement {
  isPremium: boolean;
  maxNovelties: number;
  leadsUnlimited: boolean;
  csvExport: boolean;
  grantedAt?: string;
}

export const usePremiumEntitlement = (exhibitorId?: string, eventId?: string) => {
  return useQuery({
    queryKey: ['premium-entitlement', exhibitorId, eventId],
    queryFn: async (): Promise<PremiumEntitlement> => {
      if (!exhibitorId || !eventId) {
        return {
          isPremium: false,
          maxNovelties: 1,
          leadsUnlimited: false,
          csvExport: false,
        };
      }

      const { data, error } = await supabase
        .from('premium_entitlements')
        .select('*')
        .eq('exhibitor_id', exhibitorId)
        .eq('event_id', eventId)
        .is('revoked_at', null)
        .maybeSingle();

      if (error) {
        console.error('[usePremiumEntitlement] Error:', error);
        return {
          isPremium: false,
          maxNovelties: 1,
          leadsUnlimited: false,
          csvExport: false,
        };
      }

      if (!data) {
        return {
          isPremium: false,
          maxNovelties: 1,
          leadsUnlimited: false,
          csvExport: false,
        };
      }

      return {
        isPremium: true,
        maxNovelties: data.max_novelties,
        leadsUnlimited: data.leads_unlimited,
        csvExport: data.csv_export,
        grantedAt: data.granted_at,
      };
    },
    enabled: !!exhibitorId && !!eventId,
    staleTime: 30_000,
  });
};
