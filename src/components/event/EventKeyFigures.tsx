import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { Store, Sparkles, Clock, Wand2 } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventKeyFiguresProps {
  event: Event;
  exhibitorCount?: number;
  noveltyCount?: number;
}

interface FigureItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

export const EventKeyFigures = ({ event, exhibitorCount, noveltyCount }: EventKeyFiguresProps) => {
  const figures = useMemo(() => {
    const items: FigureItem[] = [];

    // Exposants — value-add info not in Hero
    if (exhibitorCount && exhibitorCount > 0) {
      items.push({
        icon: <Store className="h-4 w-4" />,
        label: 'Exposants',
        value: `${exhibitorCount} exposants`,
      });
    }

    // Nouveautés — value-add info not in Hero
    if (noveltyCount && noveltyCount > 0) {
      items.push({
        icon: <Sparkles className="h-4 w-4" />,
        label: 'Nouveautés',
        value: `${noveltyCount} nouveautés`,
      });
    }

    // Préparation visite IA — shown when >= 80 exhibitors
    if (exhibitorCount && exhibitorCount >= 80) {
      items.push({
        icon: <Wand2 className="h-4 w-4" />,
        label: 'Visite IA',
        value: 'Parcours IA disponible',
        highlight: true,
      });
    }

    // Countdown — days until event
    if (event.date_debut) {
      const daysUntil = differenceInCalendarDays(new Date(event.date_debut), new Date());
      if (daysUntil > 0 && daysUntil <= 90) {
        items.push({
          icon: <Clock className="h-4 w-4" />,
          label: 'Compte à rebours',
          value: daysUntil === 1 ? 'Demain !' : `Dans ${daysUntil} jours`,
          highlight: daysUntil <= 7,
        });
      }
    }

    return items.slice(0, 4);
  }, [event, exhibitorCount, noveltyCount]);

  // Don't render unless at least 2 useful items
  if (figures.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {figures.map((fig, i) => (
        <div
          key={i}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-border bg-muted/40 text-muted-foreground"
        >
          <span className="flex-shrink-0">{fig.icon}</span>
          <span>{fig.value}</span>
        </div>
      ))}
    </div>
  );
};
