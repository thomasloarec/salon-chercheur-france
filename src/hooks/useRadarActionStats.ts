import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RadarActionFraction { value: number; target: number }
export interface RadarChosenEvents extends RadarActionFraction {
  available: number;
  goal_is_set: boolean;
}
export interface RadarActionStats {
  goal: number | null;
  active_member_count: number;
  is_owner: boolean;
  chosen_events: RadarChosenEvents;
  prepared_accounts: RadarActionFraction;
  met_accounts: RadarActionFraction;
  pending_followups: { open: number; overdue: number };
  members_engaged: RadarActionFraction;
}

/** Compteurs d'action du Radar CRM (fenêtre glissante 90 jours). */
export function useRadarActionStats(accountId?: string | null) {
  return useQuery({
    queryKey: ['radar-action-stats', accountId ?? 'self'],
    staleTime: 60_000,
    queryFn: async (): Promise<RadarActionStats | null> => {
      const { data, error } = await supabase.rpc('get_radar_action_stats');
      if (error) throw error;
      return (data as unknown as RadarActionStats) ?? null;
    },
  });
}

/** Fixe (ou retire, avec null) l'objectif de salons par trimestre. Owner uniquement. */
export function useSetEventsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: number | null) => {
      const { data, error } = await supabase.rpc('set_radar_events_goal', {
        p_goal: goal as unknown as number,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['radar-action-stats'] });
    },
  });
}
