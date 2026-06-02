import { Link } from 'react-router-dom';
import { CalendarDays, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ExhibitorUpcomingEvent } from '@/hooks/useExhibitorProfile';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return '';
  const opt = (d: string) => format(new Date(d), 'dd MMM yyyy', { locale: fr });
  const s = opt(start);
  const e = end ? opt(end) : s;
  return s === e ? s : `${s} – ${e}`;
}

/* --------------------------- Upcoming event row -------------------------- */

export default function ExhibitorEventCardRow({
  event,
  slug,
}: {
  event: ExhibitorUpcomingEvent;
  slug: string;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-snug">{event.nom_event}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {formatDateRange(event.date_debut, event.date_fin)}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-4 w-4 shrink-0" />
            {[event.ville, event.nom_lieu].filter(Boolean).join(' · ') || '—'}
          </p>
          {event.stand && (
            <p className="text-sm text-primary font-medium mt-1">
              Stand {event.stand}
            </p>
          )}
        </div>
        {event.slug && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() =>
              trackExhibitorEvent('event_click', slug, { event_slug: event.slug })
            }
          >
            <Link to={`/events/${event.slug}`}>Voir le salon</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}