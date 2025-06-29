
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, MapPin, Building } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EventImage } from '@/components/ui/event-image';
import { useEventSectors } from '@/hooks/useSectors';
import { getSectorConfig } from '@/constants/sectors';
import type { Event } from '@/types/event';

interface EventHeroProps {
  event: Event;
}

export const EventHero = ({ event }: EventHeroProps) => {
  const { data: eventSectors = [] } = useEventSectors(event.id);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  };

  return (
    <section className="relative">
      <div className="
        event-hero
        grid 
        grid-cols-[1fr_auto]
        items-stretch
        gap-6 
        p-6 
        bg-white 
        rounded-lg 
        shadow
      ">
        {/* Contenu principal - prend tout l'espace disponible */}
        <div className="event-hero__details space-y-6">
          <div className="space-y-4">
            {/* Affichage des secteurs */}
            <div className="flex flex-wrap gap-2">
              {eventSectors.length > 0 ? (
                eventSectors.map((sector) => {
                  const config = getSectorConfig(sector.name);
                  return (
                    <Badge 
                      key={sector.id} 
                      variant="secondary" 
                      className={`w-fit ${config.color}`}
                    >
                      {sector.name}
                    </Badge>
                  );
                })
              ) : (
                // Fallback vers l'ancien champ sector
                event.sector && (
                  <Badge variant="secondary" className="w-fit">
                    {event.sector}
                  </Badge>
                )
              )}
            </div>
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

        {/* Image avec hauteur calée sur le contenu */}
        <div className="
          event-hero__image-container
          h-full
          overflow-hidden
        ">
          <img
            src={event.image_url || ''}
            alt={`Affiche de ${event.name}`}
            loading="lazy"
            className="
              h-full
              w-auto
              object-contain
              rounded-md
              shadow-lg
            "
          />
        </div>
      </div>
    </section>
  );
};
