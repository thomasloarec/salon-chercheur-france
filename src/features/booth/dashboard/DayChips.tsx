import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { BoothCache } from '../sync/cache';
import { salonDay, shortDate } from '../salon/display';
import { isMeeting, todayInTz } from './metrics';

export function useSalonDays(cache: BoothCache, includeToday = false) {
  const ws = cache.workspace;
  return useMemo(() => {
    const m = new Map<string, ReturnType<typeof salonDay>>();
    for (const i of cache.interactions) {
      if (!isMeeting(i, cache.workspaceId)) continue;
      const d = salonDay(i.occurred_at, ws);
      m.set(d.key, d);
    }
    if (includeToday) {
      const d = salonDay(new Date().toISOString(), ws);
      m.set(d.key, d);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [cache.interactions, cache.workspaceId, ws, includeToday]);
}

export const dayChipLabel = (d: { key: string; short: string }) =>
  d.short && !d.short.includes('salon') ? d.short : shortDate(d.key);

export const salonToday = (cache: BoothCache) => todayInTz(cache.workspace.timezone || 'Europe/Paris');

export default function DayChips({
  days,
  value,
  onChange,
  allowAll = true,
}: {
  days: { key: string; short: string }[];
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
}) {
  if (days.length === 0 && !allowAll) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {allowAll && (
        <Button size="sm" variant={value === 'all' ? 'default' : 'outline'} className="min-h-[44px] shrink-0 rounded-full" onClick={() => onChange('all')}>
          Tous les jours
        </Button>
      )}
      {days.map((d) => (
        <Button key={d.key} size="sm" variant={value === d.key ? 'default' : 'outline'} className="min-h-[44px] shrink-0 rounded-full" onClick={() => onChange(d.key)}>
          {dayChipLabel(d)}
        </Button>
      ))}
    </div>
  );
}
