
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Event } from '@/types/event';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateEventSlug } from '@/utils/eventUtils';
import { EventImage } from '@/components/ui/event-image';

interface EventCardProps {
  event: Event & { 
    estimated_visitors?: number; 
    price?: string; 
    image_url?: string; 
    slug?: string;
  };
  view?: 'grid';
}

const EventCard = ({ event, view = 'grid' }: EventCardProps) => {
  // Use database-generated slug if available, otherwise fallback to client-generated
  const eventSlug = event.slug || generateEventSlug(event);
  
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  // Grid view only now
  return (
    <Card className="rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
      <Link to={`/events/${eventSlug}`} className="block">
        <div className="relative">
          <EventImage 
            src={event.image_url || ''} 
            alt={`Affiche de ${event.name}`}
          />
          {event.sector && (
            <Badge 
              className="absolute left-2 top-2"
              variant="secondary"
            >
              {event.sector}
            </Badge>
          )}
        </div>
      </Link>
      <CardContent className="p-4">
        <div className="space-y-1">
          <Link to={`/events/${eventSlug}`}>
            <h3 className="font-semibold text-lg line-clamp-2 hover:text-accent cursor-pointer">
              {event.name}
            </h3>
          </Link>
          <div className="flex items-center text-gray-600 text-sm">
            <CalendarDays className="h-4 w-4 mr-2 text-accent" />
            <span>
              {formatDate(event.start_date)}
              {event.start_date !== event.end_date && (
                <> - {formatDate(event.end_date)}</>
              )}
            </span>
          </div>
          <div className="flex items-center text-gray-600 text-sm">
            <MapPin className="h-4 w-4 mr-2 text-accent" />
            <span>{event.city}</span>
          </div>
          <Link to={`/events/${eventSlug}`}>
            <Button 
              variant="default" 
              size="sm" 
              className="w-full mt-4 bg-accent hover:bg-accent/90"
            >
              Voir le salon
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;
