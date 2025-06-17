
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Event } from '@/types/event';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateEventSlug } from '@/utils/eventUtils';
import { EventImage } from '@/components/ui/event-image';
import { useAuth } from '@/contexts/AuthContext';
import { getSectorConfig } from '@/constants/sectors';
import { cn } from '@/lib/utils';
import FavoriteButton from './FavoriteButton';

interface EventCardProps {
  event: Event & { 
    estimated_visitors?: number; 
    price?: string; 
    image_url?: string; 
    slug?: string;
  };
  view?: 'grid';
}

// Utility function for date formatting
function formatDateRange(start: string, end: string) {
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  const sd = new Date(start).toLocaleDateString('fr-FR', opt);
  const ed = new Date(end).toLocaleDateString('fr-FR', opt);
  return start === end ? sd : `${sd} – ${ed}`;
}

const EventCard = ({ event, view = 'grid' }: EventCardProps) => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@salonspro.com';

  // Use database-generated slug if available, otherwise fallback to client-generated
  const eventSlug = event.slug || generateEventSlug(event);
  
  // Use sectors directly from the event object
  const eventSectors = event.sectors || [];

  return (
    <Card className={cn(
      "flex flex-col w-full max-w-[272px] overflow-hidden rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] relative event-card",
      !event.visible && isAdmin && "bg-gray-100 opacity-50"
    )}>
      {!event.visible && isAdmin && (
        <Badge
          variant="destructive"
          className="absolute top-2 left-2 z-10"
          title="Événement invisible"
        >
          <EyeOff className="h-4 w-4" />
        </Badge>
      )}
      
      <Link to={`/events/${eventSlug}`} className="block">
        <div className="relative w-full event-card__image-wrapper">
          <img
            src={event.image_url || '/placeholder.svg'}
            alt={`Affiche de ${event.name}`}
            loading="lazy"
            className="event-card__image"
          />
          
          {/* Bouton favoris */}
          <FavoriteButton 
            eventId={event.id} 
            size="default"
            variant="overlay"
          />
          
          {/* Affichage des secteurs sur l'image */}
          <div className="absolute left-2 bottom-2 flex flex-wrap gap-1 max-w-[calc(100%-1rem)]">
            {eventSectors.length > 0 ? (
              eventSectors.slice(0, 2).map((sector) => {
                const config = getSectorConfig(sector.name);
                return (
                  <Badge 
                    key={sector.id}
                    variant="secondary"
                    className={`text-xs px-2 py-1 ${config.color} shadow-sm`}
                  >
                    {sector.name}
                  </Badge>
                );
              })
            ) : (
              // Fallback vers l'ancien champ sector
              event.sector && (
                <Badge 
                  variant="secondary"
                  className="text-xs px-2 py-1 shadow-sm"
                >
                  {event.sector}
                </Badge>
              )
            )}
            {/* Indicateur s'il y a plus de 2 secteurs */}
            {eventSectors.length > 2 && (
              <Badge 
                variant="secondary"
                className="text-xs px-2 py-1 bg-gray-500 text-white shadow-sm"
              >
                +{eventSectors.length - 2}
              </Badge>
            )}
          </div>
        </div>
      </Link>
      
      <CardContent className="flex flex-col gap-1 p-4">
        <Link to={`/events/${eventSlug}`}>
          <h3 className="font-semibold text-lg leading-5 line-clamp-2 hover:text-accent cursor-pointer" title={event.name}>
            {event.name}
          </h3>
        </Link>
        
        <p className="text-sm text-gray-600">
          {formatDateRange(event.start_date, event.end_date)}
        </p>
        
        <div className="flex items-center text-gray-600 text-sm">
          <MapPin className="h-4 w-4 mr-2 text-accent" />
          <span className="truncate">{event.city}</span>
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
      </CardContent>
    </Card>
  );
};

export default EventCard;
