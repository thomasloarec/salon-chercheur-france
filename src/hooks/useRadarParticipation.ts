import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRadarWorkspace } from '@/contexts/RadarWorkspaceContext';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';

/**
 * Participation d'équipe à un salon.
 * La vue radar n'est pas sous React Query : elle vit dans RadarWorkspaceContext.
 * On rafraîchit donc via `refreshCockpit()` du contexte (qui rappelle get_my_radar_view).
 */
export function useSetParticipation() {
  const { refreshCockpit } = useRadarWorkspace();
  return useMutation({
    mutationFn: async ({ eventId, participating }: { eventId: string; participating: boolean }) => {
      const { data, error } = await supabase.rpc('set_radar_event_participation', {
        p_event_id: eventId,
        p_participating: participating,
      });
      if (error) throw error;
      void trackRadarEvent('radar_participation_toggled', { eventId, participating });
      return data as unknown as { participating: boolean; participant_count: number };
    },
    onSuccess: () => { void refreshCockpit(); },
  });
}
