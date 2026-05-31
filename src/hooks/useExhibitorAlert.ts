import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ExhibitorAlertStatus = 'active' | 'paused' | null;

interface ExhibitorAlertState {
  enabled: boolean;
  status: ExhibitorAlertStatus;
}

/**
 * Reads/writes the "notify me of upcoming shows" alert for a public exhibitor
 * identity, backed by the `get_my_exhibitor_alert_status` / `set_exhibitor_alert`
 * RPCs (Phase 4C-pre data layer).
 *
 * Critical guarantees:
 * - For anonymous traffic (no userId) the status RPC is NEVER called: we return
 *   a stable "not enabled" state immediately so SEO traffic produces no Supabase
 *   round-trips. The caller opens AuthRequiredModal on click instead.
 * - The query key embeds `userId`, so signing in (null -> uuid) triggers an
 *   automatic refetch and the button reflects the right state without a reload.
 */
export function useExhibitorAlert(publicSlug: string | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const enabledQuery = !!publicSlug && !!userId;

  const statusQuery = useQuery<ExhibitorAlertState>({
    queryKey: ['exhibitor-alert', publicSlug, userId],
    queryFn: async (): Promise<ExhibitorAlertState> => {
      const { data, error } = await supabase.rpc('get_my_exhibitor_alert_status', {
        p_public_slug: publicSlug as string,
      });
      if (error) throw error;
      const row = (data ?? {}) as { enabled?: boolean; status?: string | null };
      return {
        enabled: row.enabled === true,
        status: (row.status as ExhibitorAlertStatus) ?? null,
      };
    },
    enabled: enabledQuery,
    staleTime: 30_000,
  });

  const mutation = useMutation<ExhibitorAlertState, Error, boolean>({
    mutationFn: async (nextEnabled: boolean): Promise<ExhibitorAlertState> => {
      if (!publicSlug || !userId) {
        throw new Error('Connexion requise pour gérer cette alerte.');
      }
      const { data, error } = await supabase.rpc('set_exhibitor_alert', {
        p_public_slug: publicSlug,
        p_enabled: nextEnabled,
        p_source_surface: 'exhibitor_profile',
      });
      if (error) throw error;
      const row = (data ?? {}) as { enabled?: boolean; status?: string | null };
      return {
        enabled: row.enabled === true,
        status: (row.status as ExhibitorAlertStatus) ?? null,
      };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['exhibitor-alert', publicSlug, userId], result);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['exhibitor-alert', publicSlug, userId],
      });
    },
  });

  // Anonymous: never call the status RPC; expose a stable default.
  const isAlertEnabled = userId ? statusQuery.data?.enabled === true : false;
  const status: ExhibitorAlertStatus = userId
    ? statusQuery.data?.status ?? null
    : null;

  return {
    isAuthenticated: !!userId,
    isAlertEnabled,
    status,
    // Only "loading" when we actually query (authenticated users).
    isLoading: enabledQuery && statusQuery.isLoading,
    isUpdating: mutation.isPending,
    /** Toggles the alert. Returns the resolved state on success. */
    toggleAlert: (nextEnabled: boolean) => mutation.mutateAsync(nextEnabled),
  };
}