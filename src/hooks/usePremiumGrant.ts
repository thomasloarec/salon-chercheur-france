import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GrantPremiumParams {
  exhibitor_id: string;
  event_id: string;
  max_novelties?: number;
  leads_unlimited?: boolean;
  csv_export?: boolean;
  notes?: string;
}

interface RevokePremiumParams {
  exhibitor_id: string;
  event_id: string;
}

export const usePremiumGrant = () => {
  const queryClient = useQueryClient();

  const grantMutation = useMutation({
    mutationFn: async (params: GrantPremiumParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('premium-grant', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to grant Premium');

      return data;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Premium activé",
        description: "L'exposant a maintenant accès aux fonctionnalités Premium pour cet événement.",
      });
      queryClient.invalidateQueries({ queryKey: ['premium-entitlement', variables.exhibitor_id, variables.event_id] });
      queryClient.invalidateQueries({ queryKey: ['novelty-quota', variables.exhibitor_id, variables.event_id] });
    },
    onError: (error: any) => {
      console.error('[usePremiumGrant] Error:', error);
      const errorMessage = error?.message || error?.error || "Impossible d'activer le Premium";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (params: RevokePremiumParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('premium-revoke', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message || 'Failed to revoke Premium');

      return data;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Premium révoqué",
        description: "L'exposant n'a plus accès aux fonctionnalités Premium pour cet événement.",
      });
      queryClient.invalidateQueries({ queryKey: ['premium-entitlement', variables.exhibitor_id, variables.event_id] });
      queryClient.invalidateQueries({ queryKey: ['novelty-quota', variables.exhibitor_id, variables.event_id] });
    },
    onError: (error: any) => {
      console.error('[usePremiumGrant] Revoke error:', error);
      const errorMessage = error?.message || error?.error || "Impossible de révoquer le Premium";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return {
    grantPremium: grantMutation.mutate,
    revokePremium: revokeMutation.mutate,
    isGranting: grantMutation.isPending,
    isRevoking: revokeMutation.isPending,
  };
};
