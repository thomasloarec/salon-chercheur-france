import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, MapPin, Building, Calendar, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EventImage } from '@/components/ui/event-image';
import { useEventSectors } from '@/hooks/useSectors';
import { getSectorConfig } from '@/constants/sectors';
import { getEventTypeLabel } from '@/constants/eventTypes';
import { formatAffluenceWithSuffix } from '@/utils/affluenceUtils';
import type { Event } from '@/types/event';

interface EventHeroProps {
  event: Event;
}

export const EventHero = ({ event }: EventHeroProps) => {
  const { data: eventSectors = [] } = useEventSectors(event.id_event || '');

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
                // Fallback vers l'ancien champ secteur
                event.secteur && (
                  <Badge variant="secondary" className="w-fit">
                    {event.secteur}
                  </Badge>
                )
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
              {event.nom_event}
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center text-base text-gray-600">
              <CalendarDays className="h-4 w-4 mr-2 text-accent flex-shrink-0" />
              <span>
                {formatDate(event.date_debut)}
                {event.date_debut !== event.date_fin && (
                  <> - {formatDate(event.date_fin)}</>
                )}
              </span>
            </div>

            <div className="flex items-center text-base text-gray-600">
              <Calendar className="h-4 w-4 mr-2 text-accent flex-shrink-0" />
              <span>{getEventTypeLabel(event.type_event)}</span>
            </div>

            {event.nom_lieu && (
              <div className="flex items-center text-base text-gray-600">
                <Building className="h-4 w-4 mr-2 text-accent flex-shrink-0" />
                <span>{event.nom_lieu}</span>
              </div>
            )}

            {event.affluence && (
              <div className="flex items-center text-base text-gray-600">
                <Users className="h-4 w-4 mr-2 text-accent flex-shrink-0" />
                <span>{formatAffluenceWithSuffix(event.affluence)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Image avec hauteur calée sur le contenu */}
        <div className="
          event-hero__image-container
          h-full
          overflow-hidden
        ">
          <img
            src={event.url_image || ''}
            alt={`Affiche de ${event.nom_event}`}
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
