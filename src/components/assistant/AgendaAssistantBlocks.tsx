import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AssistantItemCard from './AssistantItemCard';
import { useAssistantActions } from './useAssistantActions';
import { dayLabel, timeLabel } from './format';
import type { AssistantItem, AssistantKeptSession } from './types';

interface Props {
  kept: AssistantKeptSession[];
  others: AssistantItem[];
  profileId?: string;
}

const INITIAL = 3;

function CountPill({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
      {n}
    </span>
  );
}

export default function AgendaAssistantBlocks({ kept, others, profileId }: Props) {
  const { removeFromAgenda } = useAssistantActions();
  const [expanded, setExpanded] = useState(false);

  const keptSorted = useMemo(
    () =>
      [...kept].sort(
        (a, b) =>
          (a.day_date ?? '9999').localeCompare(b.day_date ?? '9999') ||
          (a.start_time ?? '99').localeCompare(b.start_time ?? '99'),
      ),
    [kept],
  );
  const othersSorted = useMemo(
    () => [...others].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [others],
  );

  if (kept.length === 0 && others.length === 0) return null;

  const shownOthers = expanded ? othersSorted : othersSorted.slice(0, INITIAL);
  const restOthers = othersSorted.length - INITIAL;

  return (
    <div className="space-y-6">
      {keptSorted.length > 0 && (
        <div className="rounded-xl bg-violet-soft/50 p-5">
          <h4 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
            Conférences retenues
            <CountPill n={keptSorted.length} />
          </h4>
          <div className="space-y-3">
            {keptSorted.map((s) => {
              const start = timeLabel(s.start_time);
              const end = timeLabel(s.end_time);
              const hours = start && end ? `${start} – ${end}` : start || end;
              const meta = [hours, s.location].filter(Boolean).join(' · ');
              return (
                <div
                  key={s.feedback_id}
                  className="flex flex-wrap items-center gap-4 rounded-[10px] border-2 border-primary bg-card px-4 py-3.5"
                >
                  <div className="w-24 shrink-0 text-center">
                    <div className="text-[22px] font-bold leading-none text-foreground">{start || '—'}</div>
                    <div className="mt-1 text-[13px] font-semibold text-muted-foreground">{dayLabel(s.day_date)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold leading-tight text-foreground">{s.title}</p>
                    {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.registration_url && (
                      <Button asChild variant="outline" className="min-h-11">
                        <a href={s.registration_url} target="_blank" rel="noopener noreferrer">
                          S'inscrire
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="min-h-11"
                      onClick={() =>
                        removeFromAgenda({ item_type: 'session', item_id: s.session_id } as AssistantItem)
                      }
                    >
                      Retirer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {othersSorted.length > 0 && (
        <div>
          <h4 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-foreground">
            Aussi à ne pas manquer sur ce salon
            <CountPill n={othersSorted.length} />
          </h4>
          <div className="space-y-3">
            {shownOthers.map((it) => (
              <div key={it.match_id} className="rounded-[10px] border border-border p-4">
                <AssistantItemCard item={it} profileId={profileId} compact />
              </div>
            ))}
            {!expanded && restOthers > 0 && (
              <Button variant="ghost" className="min-h-11" onClick={() => setExpanded(true)}>
                Voir les {restOthers} autres
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
