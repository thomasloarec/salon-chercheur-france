import { useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, MapPin, Building, Users, Tag, Store, Sparkles } from 'lucide-react';
import { getEventTypeLabel } from '@/constants/eventTypes';
import { formatAffluenceWithSuffix } from '@/utils/affluenceUtils';
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
}

export const EventKeyFigures = ({ event, exhibitorCount, noveltyCount }: EventKeyFiguresProps) => {
  const figures = useMemo(() => {
    const items: FigureItem[] = [];

    // Dates
    if (event.date_debut) {
      const start = format(new Date(event.date_debut), 'dd MMM yyyy', { locale: fr });
      const end = event.date_fin && event.date_fin !== event.date_debut
        ? format(new Date(event.date_fin), 'dd MMM yyyy', { locale: fr })
        : null;
      items.push({
        icon: <CalendarDays className="h-4 w-4" />,
        label: 'Dates',
        value: end ? `${start} – ${end}` : start,
      });
    }

    // Ville
    if (event.ville) {
      items.push({
        icon: <MapPin className="h-4 w-4" />,
        label: 'Ville',
        value: event.ville,
      });
    }

    // Lieu
    if (event.nom_lieu) {
      items.push({
        icon: <Building className="h-4 w-4" />,
        label: 'Lieu',
        value: event.nom_lieu,
      });
    }

    // Type
    if (event.type_event) {
      items.push({
        icon: <Tag className="h-4 w-4" />,
        label: 'Type',
        value: getEventTypeLabel(event.type_event),
      });
    }

    // Affluence
    if (event.affluence) {
      const formatted = formatAffluenceWithSuffix(event.affluence);
      if (formatted) {
        items.push({
          icon: <Users className="h-4 w-4" />,
          label: 'Visiteurs',
          value: formatted,
        });
      }
    }

    // Exhibitors
    if (exhibitorCount && exhibitorCount > 0) {
      items.push({
        icon: <Store className="h-4 w-4" />,
        label: 'Exposants',
        value: `${exhibitorCount}`,
      });
    }

    // Novelties
    if (noveltyCount && noveltyCount > 0) {
      items.push({
        icon: <Sparkles className="h-4 w-4" />,
        label: 'Nouveautés',
        value: `${noveltyCount}`,
      });
    }

    // Secteur principal
    const sector = Array.isArray(event.secteur) ? event.secteur[0] : event.secteur;
    if (sector) {
      items.push({
        icon: <Tag className="h-4 w-4" />,
        label: 'Secteur',
        value: sector,
      });
    }

    return items;
  }, [event, exhibitorCount, noveltyCount]);

  if (figures.length === 0) return null;

  return (
    <section className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Chiffres clés</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {figures.map((fig, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
            <div className="text-primary mt-0.5 flex-shrink-0">{fig.icon}</div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{fig.label}</p>
              <p className="text-sm font-medium text-foreground truncate">{fig.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
