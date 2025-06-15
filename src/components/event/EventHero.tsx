
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, MapPin, Building } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EventImage } from '@/components/ui/event-image';
import type { Event } from '@/types/event';

interface EventHeroProps {
  event: Event;
}

export const EventHero = ({ event }: EventHeroProps) => {
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  };

  return (
    <section className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit">
              {event.sector}
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              {event.name}
            </h1>
          </div>

          <div className="space-y-3">
            <div className="flex items-center text-lg text-gray-600">
              <CalendarDays className="h-5 w-5 mr-3 text-accent" />
              <span>
                {formatDate(event.start_date)}
                {event.start_date !== event.end_date && (
                  <> - {formatDate(event.end_date)}</>
                )}
              </span>
            </div>

            <div className="flex items-center text-lg text-gray-600">
              <MapPin className="h-5 w-5 mr-3 text-accent" />
              <span>{event.city}, {event.region || 'France'}</span>
            </div>

            {event.venue_name && (
              <div className="flex items-center text-lg text-gray-600">
                <Building className="h-5 w-5 mr-3 text-accent" />
                <span>{event.venue_name}</span>
              </div>
            )}
          </div>

          {event.estimated_visitors && (
            <div className="bg-accent/10 rounded-lg p-4">
              <p className="text-accent font-semibold">
                {event.estimated_visitors.toLocaleString()} visiteurs attendus
              </p>
            </div>
          )}
        </div>

        <div className="relative max-w-md mx-auto lg:max-w-none">
          <EventImage
            src={event.image_url || ''}
            alt={`Affiche de ${event.name}`}
            className="rounded-2xl shadow-lg"
          />
        </div>
      </div>
    </section>
  );
};
