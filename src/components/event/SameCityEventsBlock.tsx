import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, MapPin, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSameCityEvents } from '@/hooks/useSameCityEvents';
import type { Event } from '@/types/event';

interface SameCityEventsBlockProps {
  event: Pick<Event, 'id' | 'ville'>;
}

/**
 * Shows up to 4 upcoming events in the same city.
 * Uses the same card style as RelatedEvents.
 * Hidden if fewer than 2 results.
 */
export const SameCityEventsBlock = ({ event }: SameCityEventsBlockProps) => {
  const { data: cityEvents, isLoading } = useSameCityEvents(event);

  if (!isLoading && (!cityEvents || cityEvents.length < 2)) {
    return null;
  }

  if (isLoading) return null; // silent load — no skeleton to avoid layout shift

  const formatDate = (dateStr: string) =>
    format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        Salons à {event.ville}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cityEvents!.map((ev) => (
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
