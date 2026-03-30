import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventSeries } from '@/hooks/useEventSeries';
import type { Event } from '@/types/event';

interface EventSeriesBlockProps {
  event: Pick<Event, 'id' | 'nom_event'>;
  onSeriesIds?: (ids: string[]) => void;
}

/**
 * Shows other editions of the same event series.
 * Uses the same card style as RelatedEvents for visual consistency.
 */
export const EventSeriesBlock = ({ event, onSeriesIds }: EventSeriesBlockProps) => {
  const { data: seriesEvents, isLoading } = useEventSeries(event);

  // Limit to 4 items (single row on desktop)
  const displayEvents = seriesEvents?.slice(0, 4);

  // Notify parent of series event IDs for deduplication
  useEffect(() => {
    if (onSeriesIds && displayEvents && displayEvents.length > 0) {
      onSeriesIds(displayEvents.map(e => e.id));
    } else if (onSeriesIds && !isLoading && (!displayEvents || displayEvents.length === 0)) {
      onSeriesIds([]);
    }
  }, [displayEvents, isLoading, onSeriesIds]);

  // Don't render if fewer than 2 results
  if (!isLoading && (!displayEvents || displayEvents.length < 2)) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-primary" />
          Autres éditions de ce salon
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-24 w-full rounded-md mb-3" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      </section>
    );
  }

  const formatDate = (dateStr: string) =>
    format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <ArrowRight className="h-5 w-5 text-primary" />
        Autres éditions de ce salon
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayEvents!.map((ev) => (
          <Link
            key={ev.id}
            to={`/events/${ev.slug}`}
            className="group"
          >
            <Card className="p-4 h-full hover:shadow-md transition-shadow border-primary/10 hover:border-primary/30">
              {ev.url_image && (
                <div className="aspect-video rounded-md overflow-hidden mb-3 bg-muted">
                  <img
                    src={ev.url_image}
                    alt={ev.nom_event}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              <h3 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
                {ev.nom_event}
              </h3>

              <div className="space-y-1 text-xs text-muted-foreground">
                {ev.date_debut && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(ev.date_debut)}</span>
                  </div>
                )}
                {ev.ville && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{ev.ville}</span>
                  </div>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};
