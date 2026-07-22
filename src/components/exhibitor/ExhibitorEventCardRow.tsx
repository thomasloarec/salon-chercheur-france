import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

/**
 * Computes a lightweight status badge purely from the event dates already
 * fetched (no extra query / SQL). Returns null when no start date is known.
 */
function getEventStatus(
  start: string | null,
  end: string | null
): { label: string; ongoing: boolean } | null {
  if (!start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = end ? new Date(end) : startDate;
  endDate.setHours(0, 0, 0, 0);

  if (startDate <= today && today <= endDate) {
    return { label: 'En cours', ongoing: true };
  }
  const diffDays = Math.round(
    (startDate.getTime() - today.getTime()) / 86_400_000
  );
  if (diffDays <= 0) return { label: 'À venir', ongoing: false };
  if (diffDays === 1) return { label: 'Demain', ongoing: false };
  if (diffDays <= 7) return { label: `Dans ${diffDays} jours`, ongoing: false };
  if (diffDays <= 30) return { label: 'Bientôt', ongoing: false };
  return { label: 'À venir', ongoing: false };
}

/* --------------------------- Upcoming event row -------------------------- */

export default function ExhibitorEventCardRow({
  event,
  slug,
  featured = false,
}: {
  event: ExhibitorUpcomingEvent;
  slug: string;
  /** Highlights the next (soonest) event as a stronger premium card. */
  featured?: boolean;
}) {
  const status = getEventStatus(event.date_debut, event.date_fin);

  const StatusBadge = status ? (
    status.ongoing ? (
      <Badge className="gap-1 bg-primary text-primary-foreground">
        <Radio className="h-3 w-3 animate-pulse" />
        {status.label}
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        {status.label}
      </Badge>
    )
  ) : null;

  if (featured) {
    return (
      <Card className="rounded-2xl border-primary/30 bg-bubble/40 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-background">
              Prochain salon
            </Badge>
            {StatusBadge}
          </div>
          <h3 className="heading-display text-[1.2rem] leading-tight text-foreground">{event.nom_event}</h3>
          <div className="mt-2 space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" />
              {formatDateRange(event.date_debut, event.date_fin)}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {[event.ville, event.nom_lieu].filter(Boolean).join(' · ') || '—'}
            </p>
            {event.stand && (
              <p className="text-sm text-primary font-medium">
                Stand {event.stand}
              </p>
            )}
          </div>
          {event.slug && (
            <Button
              asChild
              className="mt-4 w-full sm:w-auto"
              onClick={() =>
                trackExhibitorEvent('event_click', slug, {
                  event_slug: event.slug,
                })
              }
            >
              <Link to={`/events/${event.slug}`}>Voir le salon</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="heading-display text-[1.05rem] leading-tight text-foreground">{event.nom_event}</h3>
            {StatusBadge}
          </div>
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