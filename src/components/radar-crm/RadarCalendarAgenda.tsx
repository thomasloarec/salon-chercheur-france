import React, { useMemo } from 'react';
import { Building2, ChevronRight, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type EventGroup } from '@/types/radar';
import { ParticipantAvatar } from '@/components/radar-crm/RadarParticipants';
import {
  parseYmd, mondayOf, isoWeekNumber, weekKey, diffDays,
  weekRangeLabel, monthLabel, dayMonthLabel,
} from '@/lib/radarCrm/weeks';

/**
 * Vue calendrier pour mobile : agenda vertical groupé par semaine.
 * Sur un écran de téléphone, une grille de 7 colonnes ne laisse que ~40 px
 * par jour : le nom des salons devient illisible. Ici chaque salon occupe
 * toute la largeur, son nom complet reste lisible et le repère semaine est conservé.
 */

interface AgendaWeek {
  key: string;
  monday: Date;
  weekNo: number;
  isCurrent: boolean;
  monthStart: string | null;
  items: EventGroup[];
}

const dateRange = (g: EventGroup): string => {
  const start = parseYmd(g.date_debut);
  const end = parseYmd(g.date_fin) ?? start;
  if (!start) return '';
  if (!end || diffDays(end, start) <= 0) return dayMonthLabel(start);
  return `${dayMonthLabel(start)} au ${dayMonthLabel(end)}`;
};

const RadarCalendarAgenda: React.FC<{
  groups: EventGroup[];
  highlightedEventId?: string | null;
  onSelectEvent: (g: EventGroup) => void;
}> = ({ groups, highlightedEventId, onSelectEvent }) => {
  const weeks = useMemo<AgendaWeek[]>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMonday = mondayOf(today);

    // Un salon déjà commencé (en cours) est rangé dans la semaine courante.
    const placed = groups
      .map((g) => {
        const start = parseYmd(g.date_debut);
        if (!start) return null;
        const anchor = start < today ? today : start;
        return { group: g, start, monday: mondayOf(anchor) };
      })
      .filter((x): x is { group: EventGroup; start: Date; monday: Date } => x !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime()
        || a.group.nom_event.localeCompare(b.group.nom_event, 'fr'));

    const byWeek = new Map<string, AgendaWeek>();
    for (const p of placed) {
      const key = weekKey(p.monday);
      let w = byWeek.get(key);
      if (!w) {
        w = {
          key,
          monday: p.monday,
          weekNo: isoWeekNumber(p.monday),
          isCurrent: diffDays(p.monday, currentMonday) === 0,
          monthStart: null,
          items: [],
        };
        byWeek.set(key, w);
      }
      w.items.push(p.group);
    }

    const ordered = [...byWeek.values()].sort((a, b) => a.monday.getTime() - b.monday.getTime());
    let lastMonth: string | null = null;
    for (const w of ordered) {
      const m = `${w.monday.getFullYear()}-${w.monday.getMonth()}`;
      w.monthStart = m !== lastMonth ? monthLabel(w.monday) : null;
      lastMonth = m;
    }
    return ordered;
  }, [groups]);

  if (weeks.length === 0) return null;

  return (
    <div className="space-y-1">
      {weeks.map((w, wi) => (
        <section key={w.key} aria-label={`Semaine ${w.weekNo}`}>
          {w.monthStart && (
            <h3 className={cn('pb-1 text-[15px] font-semibold text-foreground', wi === 0 ? 'pt-0' : 'pt-5')}>{w.monthStart}</h3>
          )}
          <div className="flex items-baseline gap-2 pt-3 pb-2">
            <span className={cn('text-[13px] font-semibold', w.isCurrent ? 'text-primary' : 'text-foreground')}>
              {w.isCurrent ? 'Cette semaine' : `Semaine ${w.weekNo}`}
            </span>
            <span className="text-xs text-muted-foreground">{weekRangeLabel(w.monday)}</span>
          </div>
          <ul className="space-y-2">
            {w.items.map((g) => {
              const imminent = g.days_until != null && g.days_until < 10;
              const ongoing = g.days_until != null && g.days_until <= 0;
              const parts = g.participants ?? [];
              const place = [g.ville, g.nom_lieu].filter(Boolean)[0] ?? null;
              return (
                <li key={g.event_id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(g)}
                    className={cn(
                      'w-full min-h-[56px] rounded-lg border border-l-[3px] bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                      parts.length > 0
                        ? 'border-l-[#6b51ff] border-border'
                        : imminent ? 'border-l-primary border-border' : 'border-l-primary/40 border-border',
                      highlightedEventId === g.event_id && 'ring-1 ring-primary border-primary',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-foreground line-clamp-2 break-words">
                          {g.nom_event}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {ongoing ? (
                            <span className="font-medium text-primary">En cours</span>
                          ) : (
                            <span>{dateRange(g)}</span>
                          )}
                          {place && (
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{place}</span>
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        {parts.length > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <ParticipantAvatar participant={parts[0]} size={18} />
                            {parts.length > 1 && (
                              <span className="text-[10px] font-medium text-[#6b51ff]">+{parts.length - 1}</span>
                            )}
                          </span>
                        )}
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                          aria-label={`${g.company_count} compte${g.company_count > 1 ? 's' : ''}`}
                        >
                          <Building2 className="h-3 w-3" />
                          {g.company_count}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default RadarCalendarAgenda;
