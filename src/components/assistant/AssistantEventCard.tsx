import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AssistantSuggestion } from './types';
import AssistantItemCard from './AssistantItemCard';
import { useAssistantActions, type WontGoReason } from './useAssistantActions';
import { countLabel, daysUntil } from './format';

interface Props {
  suggestion: AssistantSuggestion;
  profileId?: string;
  readOnly?: boolean;
  onProposeDistance?: () => void;
}

function dateRange(start: string, end?: string | null): string {
  try {
    const s = parseISO(start);
    const e = end ? parseISO(end) : s;
    if (format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd')) return format(s, 'd MMM yyyy', { locale: fr });
    if (format(s, 'yyyy-MM') === format(e, 'yyyy-MM'))
      return `${format(s, 'd')} – ${format(e, 'd MMM yyyy', { locale: fr })}`;
    return `${format(s, 'd MMM', { locale: fr })} – ${format(e, 'd MMM yyyy', { locale: fr })}`;
  } catch {
    return '';
  }
}

const WONT_GO: { key: WontGoReason; label: string }[] = [
  { key: 'pas_disponible', label: 'Pas disponible à ces dates' },
  { key: 'trop_loin', label: 'Trop loin' },
  { key: 'pas_interesse', label: 'Ce salon ne m\u2019intéresse pas' },
];

export default function AssistantEventCard({ suggestion, profileId, readOnly, onProposeDistance }: Props) {
  const { event } = suggestion;
  const actions = useAssistantActions({ onProposeDistance });
  const items = [...(suggestion.pepites ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const start = parseISO(event.date_debut);
  const count = countLabel(items);

  return (
    <article className="overflow-hidden rounded-[14px] bg-card shadow-sm">
      <header className="flex flex-col gap-4 bg-surface-inverse p-4 text-inverse sm:flex-row sm:items-start sm:p-6">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-xs font-bold uppercase">{format(start, 'MMM', { locale: fr })}</span>
            <span className="text-2xl font-bold leading-none">{format(start, 'd')}</span>
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="heading-display text-[24px] leading-tight sm:text-[28px]">
              <Link to={`/events/${event.slug}`} className="hover:underline focus-visible:underline">
                {event.nom_event}
              </Link>
            </h3>
            <p className="text-sm text-inverse-muted">
              {[dateRange(event.date_debut, event.date_fin), event.ville, event.nom_lieu].filter(Boolean).join(' · ')}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-info-surface px-3 py-1 text-xs font-semibold text-surface-inverse">
                {daysUntil(event.date_debut, event.date_fin)}
              </span>
              {count && (
                <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-surface-inverse">
                  {count}
                </span>
              )}
            </div>
          </div>
        </div>
        {!readOnly && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:items-end">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full bg-background text-foreground hover:bg-background/90 sm:w-auto"
              onClick={() => actions.addEventToAgenda(event.id)}
            >
              Ajouter le salon
            </Button>
            {profileId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full gap-1 border-inverse-muted bg-transparent text-inverse hover:bg-inverse/10 hover:text-inverse sm:w-auto"
                  >
                    Je n'irai pas
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {WONT_GO.map((w) => (
                    <DropdownMenuItem
                      key={w.key}
                      className="min-h-11"
                      onSelect={() => actions.wontGo(event.id, w.key, profileId)}
                    >
                      {w.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </header>
      <div className="divide-y divide-border bg-card px-3 sm:px-6">
        {items.map((it) => (
          <AssistantItemCard
            key={it.match_id}
            item={it}
            profileId={profileId}
            readOnly={readOnly}
            onProposeDistance={onProposeDistance}
          />
        ))}
      </div>
    </article>
  );
}
