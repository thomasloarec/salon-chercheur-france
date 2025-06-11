
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin, Users, Building, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Event } from '@/types/event';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import CalBtn from './CalBtn';

interface EventCardProps {
  event: Event & { 
    estimated_visitors?: number; 
    price?: string; 
    image_url?: string; 
  };
  view?: 'grid' | 'list';
}

const EventCard = ({ event, view = 'grid' }: EventCardProps) => {
  const fallbackImage = '/placeholder.svg';
  
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  if (view === 'list') {
    return (
      <div className="flex items-start gap-4 py-4 border-b">
        <div className="flex-1 space-y-1">
          <h3 className="font-semibold text-lg">{event.name}</h3>
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
            <span>{event.city}{event.region && `, ${event.region}`}</span>
          </div>
          {event.venue_name && (
            <div className="flex items-center text-gray-600 text-sm">
              <Building className="h-4 w-4 mr-2 text-accent" />
              <span>{event.venue_name}</span>
            </div>
          )}
          <div className="flex items-center text-gray-600 text-sm">
            <Users className="h-4 w-4 mr-2 text-accent" />
            <span>
              {event.estimated_visitors ? 
                `${event.estimated_visitors.toLocaleString()} visiteurs attendus` : 
                'Visiteurs N.C.'
              } • {event.price || 'Tarif N.C.'}
            </span>
          </div>
          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {event.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {event.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{event.tags.length - 3} autres
                </Badge>
              )}
            </div>
          )}
          {event.description && (
            <p className="text-sm line-clamp-2 text-gray-600">
              {event.description}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <CalBtn type="gcal" event={event} />
            <CalBtn type="outlook" event={event} />
            {event.event_url && (
              <Button 
                variant="default" 
                size="sm" 
                className="bg-accent hover:bg-accent/90"
                onClick={() => window.open(event.event_url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Voir le salon
              </Button>
            )}
          </div>
        </div>
        <img 
          src={event.image_url || fallbackImage} 
          alt={event.name}
          className="w-[120px] h-[160px] object-cover rounded"
        />
      </div>
    );
  }

  // Grid view
  return (
    <Card className="rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
      <div className="relative h-56">
        <img 
          src={event.image_url || fallbackImage} 
          alt={event.name}
          className="h-full w-full object-cover"
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
      <CardContent className="p-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg line-clamp-2">{event.name}</h3>
          <p className="text-sm text-muted-foreground">
            {formatDate(event.start_date)}
            {event.start_date !== event.end_date && (
              <> - {formatDate(event.end_date)}</>
            )} – {event.city}
          </p>
          <div className="flex gap-2 mt-2">
            <CalBtn type="gcal" event={event} />
            <CalBtn type="outlook" event={event} />
          </div>
          {event.event_url && (
            <Button 
              variant="default" 
              size="sm" 
              className="w-full mt-2 bg-accent hover:bg-accent/90"
              onClick={() => window.open(event.event_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir le salon
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;
