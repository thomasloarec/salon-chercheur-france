import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import AssistantEventCard from './AssistantEventCard';
import type { AssistantSuggestion } from './types';

interface Props {
  suggestions: AssistantSuggestion[];
  profileId?: string;
  refreshing?: boolean;
}

const INITIAL = 3;

export default function AssistantDiscoverSection({ suggestions, profileId, refreshing }: Props) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? suggestions : suggestions.slice(0, INITIAL);
  const rest = suggestions.length - INITIAL;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={headingId} className="heading-display text-[30px] leading-tight text-foreground">
            À découvrir
          </h2>
          <span className="inline-flex items-center rounded-full bg-surface-inverse px-2.5 py-0.5 text-sm font-bold text-inverse">
            {suggestions.length}
          </span>
        </div>
        <p className="mt-1 text-base text-muted-foreground">
          Les salons où des conférences et des Nouveautés sont à ne pas manquer pour vous.
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 text-base text-foreground">
          {refreshing
            ? 'Je relis les programmes et les Nouveautés de vos prochains salons. Revenez dans quelques minutes.'
            : 'Rien ne vaut encore le déplacement. Je vous écris dès que ça change.'}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((s) => (
            <AssistantEventCard key={s.event.id} suggestion={s} profileId={profileId} />
          ))}
          {!expanded && rest > 0 && (
            <Button variant="outline" className="min-h-11" onClick={() => setExpanded(true)}>
              Voir les {rest} autres salons
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
