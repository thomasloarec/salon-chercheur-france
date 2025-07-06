
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CalBtn from '@/components/CalBtn';
import { useEventSectors } from '@/hooks/useSectors';
import { getSectorConfig } from '@/constants/sectors';
import type { Event } from '@/types/event';

interface EventHeaderProps {
  event: Event;
}

export const EventHeader = ({ event }: EventHeaderProps) => {
  const { data: eventSectors = [] } = useEventSectors(event.id);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  };

  return (
    <header className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {eventSectors.length > 0 ? (
            eventSectors.map((sector) => {
              const config = getSectorConfig(sector.name);
              return (
                <Badge 
                  key={sector.id} 
                  variant="secondary"
                  className={config.color}
                >
                  {sector.name}
                </Badge>
              );
            })
          ) : (
            // Fallback vers l'ancien champ sector
            event.sector && (
              <Badge variant="secondary">{event.sector}</Badge>
            )
          )}
          {event.tags?.map((tag, index) => (
            <Badge key={index} variant="outline">{tag}</Badge>
          ))}
        </div>

        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
          {event.name}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center text-gray-600">
            <CalendarDays className="h-5 w-5 mr-3 text-accent" />
            <span>
              {formatDate(event.start_date)}
              {event.start_date !== event.end_date && (
                <> - {formatDate(event.end_date)}</>
              )}
            </span>
          </div>

          <div className="flex items-center text-gray-600">
            <MapPin className="h-5 w-5 mr-3 text-accent" />
            <span>{event.city}, {event.region || 'France'}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2">
            <CalBtn type="gcal" event={event} />
            <CalBtn type="outlook" event={event} />
          </div>
          
          {event.website_url && (
            <Button 
              variant="outline"
              onClick={() => window.open(event.website_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Site officiel
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
