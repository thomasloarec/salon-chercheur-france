import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RadarLiveEvent {
  eventId: string;
  nomEvent: string | null;
}

/** Date du jour au format YYYY-MM-DD, sans conversion de fuseau. */
const todayKey = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export function useRadarLiveEvent() {
  const { user } = useAuth();

  return useQuery<RadarLiveEvent | null>({
    queryKey: ['radar-live-event', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_radar_view', { p_import_id: null });
      if (error) throw error;

      const view = data as unknown as {
        events?: Array<{ event_id: string; nom_event: string | null; date_debut: string | null; date_fin: string | null }>;
      } | null;

      const today = todayKey();
      const live = (view?.events ?? [])
        .filter((e) => {
          const debut = e.date_debut?.slice(0, 10);
          const fin = (e.date_fin ?? e.date_debut)?.slice(0, 10);
          return !!debut && !!fin && debut <= today && today <= fin;
        })
        .sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? ''))[0];

      return live ? { eventId: live.event_id, nomEvent: live.nom_event } : null;
    },
  });
}
