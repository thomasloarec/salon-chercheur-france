import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventCardStat {
  exhibitor_count: number;
  novelty_count: number;
}

export type EventCardStatsMap = Record<string, EventCardStat>;

/**
 * Batched public stats (unique exhibitors + published novelties) for a list of events.
 * Powers the discreet stat bubbles on event cards. Uses the SECURITY DEFINER RPC
 * `get_event_card_stats` which already filters to publicly visible events/novelties.
 */
export function useEventCardStats(eventIds: string[]) {
  const ids = Array.from(new Set(eventIds.filter(Boolean))).sort();

  return useQuery<EventCardStatsMap>({
    queryKey: ['event-card-stats', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_event_card_stats', {
        _event_ids: ids,
      });
      if (error) throw error;

      const map: EventCardStatsMap = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data ?? []).forEach((row: any) => {
        map[row.event_id] = {
          exhibitor_count: Number(row.exhibitor_count) || 0,
          novelty_count: Number(row.novelty_count) || 0,
        };
      });
      return map;
    },
  });
}
