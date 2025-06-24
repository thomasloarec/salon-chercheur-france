
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CrmProvider, CrmIntegrationStatus } from '@/types/crm';
import { syncCrmAccounts } from '@/lib/syncCrmAccounts';

export const useCrmIntegrations = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['crm-integrations', user?.id],
    queryFn: async (): Promise<CrmIntegrationStatus[]> => {
      if (!user) return [];

      const providers: CrmProvider[] = ['salesforce', 'hubspot', 'pipedrive', 'zoho'];
      const statuses: CrmIntegrationStatus[] = [];

      for (const provider of providers) {
        // Check if connection exists
        const { data: connection } = await supabase
          .from('user_crm_connections')
          .select('updated_at')
          .eq('user_id', user.id)
          .eq('provider', provider)
          .single();

        // Count synced accounts
        const { count } = await supabase
          .from('user_crm_companies')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('provider', provider);

        statuses.push({
          provider,
          connected: !!connection,
          lastSync: connection?.updated_at,
          accountsCount: count || 0,
        });
      }

      return statuses;
    },
    enabled: !!user,
  });
};

export const useSyncCrmAccounts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (provider: CrmProvider) => {
      if (!user) throw new Error('User not authenticated');
      return await syncCrmAccounts(user.id, provider);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-integrations', user?.id] });
    },
  });
};

export const useDisconnectCrm = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (provider: CrmProvider) => {
      if (!user) throw new Error('User not authenticated');

      // Delete CRM connection
      const { error } = await supabase
        .from('user_crm_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', provider);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-integrations', user?.id] });
    },
  });
};
