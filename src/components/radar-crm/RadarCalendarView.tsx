import React, { useMemo, useState } from 'react';
import { ChevronRight, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type EventGroup } from '@/types/radar';
import { ParticipantAvatar } from '@/components/radar-crm/RadarParticipants';
import {
  parseYmd, addDays, mondayOf, isoWeekNumber, weekKey, isoDayIndex, diffDays,
  weekRangeLabel, monthLabel, dayMonthLabel,
} from '@/lib/radarCrm/weeks';

interface Segment {
  group: EventGroup;
  start: number; // 0 = lundi
  span: number;
  row: number;
}

interface WeekRow {
  key: string;
  monday: Date;
  weekNo: number;
  segments: Segment[];
  isCurrent: boolean;
  monthStart: string | null;
}

type Row =
  | { kind: 'week'; week: WeekRow }
  | { kind: 'gap'; key: string; weeks: WeekRow[] };

const DAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const RadarCalendarView: React.FC<{
  groups: EventGroup[];
  highlightedEventId?: string | null;
  onSelectEvent: (g: EventGroup) => void;
}> = ({ groups, highlightedEventId, onSelectEvent }) => {
  const [expandedGaps, setExpandedGaps] = useState<Record<string, boolean>>({});

  const rows = useMemo<Row[]>(() => {
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const spans = groups
      .map((g) => {
        const start = parseYmd(g.date_debut);
        if (!start) return null;
        const end = parseYmd(g.date_fin) ?? start;
        return { group: g, start, end: end < start ? start : end };
      })
      .filter((x): x is { group: EventGroup; start: Date; end: Date } => x !== null);

    if (spans.length === 0) return [];

    const firstMonday = mondayOf(todayMid);
    let lastEnd = spans[0].end;
    for (const s of spans) if (s.end > lastEnd) lastEnd = s.end;
    const lastMonday = mondayOf(lastEnd);
    const weekCount = Math.max(0, Math.round(diffDays(lastMonday, firstMonday) / 7)) + 1;

    const weeks: WeekRow[] = [];
    let lastMonthSeen: string | null = null;
    for (let i = 0; i < weekCount; i += 1) {
      const monday = addDays(firstMonday, i * 7);
      const sunday = addDays(monday, 6);
      const segments: Segment[] = [];
      for (const s of spans) {
        if (s.end < monday || s.start > sunday) continue;
        const segStart = s.start < monday ? monday : s.start;
        const segEnd = s.end > sunday ? sunday : s.end;
        segments.push({
          group: s.group,
          start: isoDayIndex(segStart),
          span: diffDays(segEnd, segStart) + 1,
          row: 0,
        });
      }
      segments.sort((a, b) => a.start - b.start || b.span - a.span);
      // Empilement : une rangée par salon qui se chevauche.
      const rowEnds: number[] = [];
      for (const seg of segments) {
        let r = rowEnds.findIndex((end) => end <= seg.start);
        if (r === -1) { r = rowEnds.length; rowEnds.push(0); }
        rowEnds[r] = seg.start + seg.span;
        seg.row = r;
      }
      // Séparateur de mois : mois du lundi, ou du dimanche si le mois change en cours de semaine.
      const monthOfWeek = `${monday.getFullYear()}-${monday.getMonth()}`;
      const monthStart = monthOfWeek !== lastMonthSeen ? monthLabel(monday) : null;
      lastMonthSeen = monthOfWeek;
      weeks.push({
        key: weekKey(monday),
        monday,
        weekNo: isoWeekNumber(monday),
        segments,
        isCurrent: diffDays(todayMid, monday) >= 0 && diffDays(todayMid, monday) <= 6,
        monthStart,
      });
    }

    // Compression des suites d'au moins deux semaines vides.
    const out: Row[] = [];
    let buffer: WeekRow[] = [];
    const flush = () => {
      if (buffer.length === 0) return;
      if (buffer.length >= 2) {
        out.push({ kind: 'gap', key: `gap-${buffer[0].key}`, weeks: buffer });
      } else {
        out.push({ kind: 'week', week: buffer[0] });
      }
      buffer = [];
    };
    for (const w of weeks) {
      if (w.segments.length === 0 && !w.isCurrent) {
        buffer.push(w);
      } else {
        flush();
        out.push({ kind: 'week', week: w });
      }
    }
    flush();
    return out;
  }, [groups]);

  if (rows.length === 0) return null;

  const renderWeek = (w: WeekRow) => {
    const rowsInWeek = Math.max(1, w.segments.reduce((m, s) => Math.max(m, s.row + 1), 0));
    const todayIdx = w.isCurrent ? isoDayIndex(new Date()) : -1;
    return (
      <React.Fragment key={w.key}>
        {w.monthStart && (
          <div className="pt-6 pb-2 text-[15px] font-medium text-foreground">{w.monthStart}</div>
        )}
        <div
          className="grid gap-x-1 gap-y-1 border-t border-border/60 py-1.5"
          style={{
            gridTemplateColumns: 'var(--wk-label) repeat(7, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${rowsInWeek}, minmax(1.75rem, auto))`,
          }}
        >
          <div
            className="flex flex-col justify-center pr-2"
            style={{ gridColumn: '1 / 2', gridRow: `1 / span ${rowsInWeek}` }}
          >
            <span className={cn('text-[13px] font-medium', w.isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
              S{w.weekNo}
            </span>
            <span className="hidden sm:block text-[11px] text-muted-foreground">
              {weekRangeLabel(w.monday)}
            </span>
          </div>

          {todayIdx >= 0 && w.segments.every((s) => !(todayIdx >= s.start && todayIdx < s.start + s.span && s.row === 0)) && (
            <div
              className="flex items-center justify-center"
              style={{ gridColumn: `${2 + todayIdx} / span 1`, gridRow: '1 / span 1' }}
            >
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                Auj.
              </span>
            </div>
          )}

          {w.segments.map((s, i) => {
            const imminent = s.group.days_until != null && s.group.days_until < 10;
            const parts = s.group.participants ?? [];
            const joined = parts.length > 0;
            const start = parseYmd(s.group.date_debut);
            const end = parseYmd(s.group.date_fin) ?? start;
            const label = start
              ? `${s.group.nom_event}, du ${dayMonthLabel(start)}${end && end > start ? ` au ${dayMonthLabel(end)}` : ''}, ${s.group.company_count} compte${s.group.company_count > 1 ? 's' : ''}`
              : s.group.nom_event;
            return (
              <button
                key={`${s.group.event_id}-${i}`}
                type="button"
                onClick={() => onSelectEvent(s.group)}
                aria-label={label}
                title={label}
                className={cn(
                  'min-w-0 rounded-r-[6px] rounded-l-none border border-l-2 px-2 py-1 text-left text-xs transition-colors flex items-center gap-1',
                  joined
                    ? 'bg-[#eeedfe] border-l-[#6b51ff] border-border text-foreground hover:bg-[#e4e2fd]'
                    : imminent
                      ? 'bg-primary/10 border-l-primary border-border hover:bg-primary/15'
                      : 'bg-background border-l-primary/40 border-border text-foreground hover:bg-muted/60',
                  highlightedEventId === s.group.event_id && 'border-primary ring-1 ring-primary',
                )}
                style={{ gridColumn: `${2 + s.start} / span ${s.span}`, gridRow: `${s.row + 1} / span 1` }}
              >
                <span className="truncate min-w-0">{s.group.nom_event}</span>
                <span className="inline-flex items-center gap-0.5 shrink-0 text-[11px] opacity-70">
                  <Building2 className="h-3 w-3" />
                  {s.group.company_count}
                </span>
                {joined && (
                  <span className="inline-flex shrink-0 items-center gap-0.5">
                    <ParticipantAvatar participant={parts[0]} size={16} />
                    {parts.length > 1 && (
                      <span className="text-[10px] font-medium text-[#6b51ff]">+{parts.length - 1}</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 sm:p-4" style={{ ['--wk-label' as string]: '56px' }}>
      <style>{`@media (min-width: 640px){ .radar-cal { --wk-label: 76px; } }`}</style>
      <div className="radar-cal">
        <div
          className="grid gap-x-1 pb-1"
          style={{ gridTemplateColumns: 'var(--wk-label) repeat(7, minmax(0, 1fr))' }}
        >
          <span />
          {DAY_HEADERS.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className={cn('text-[11px]', i >= 5 ? 'text-muted-foreground/50' : 'text-muted-foreground')}
            >
              {d}
            </span>
          ))}
        </div>

        {rows.map((row) => {
          if (row.kind === 'week') return renderWeek(row.week);
          if (expandedGaps[row.key]) return row.weeks.map(renderWeek);
          const first = row.weeks[0];
          const last = row.weeks[row.weeks.length - 1];
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => setExpandedGaps((p) => ({ ...p, [row.key]: true }))}
              className="flex w-full items-center gap-1.5 border-t border-border/60 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              S{first.weekNo} à S{last.weekNo} · {row.weeks.length} semaines sans salon
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RadarCalendarView;
