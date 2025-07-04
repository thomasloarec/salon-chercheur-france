
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin, EyeOff, Eye } from 'lucide-react';
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
import { SectorBadge } from '@/components/ui/sector-badge';

interface EventCardProps {
  event: Event & { 
    estimated_visitors?: number; 
    price?: string; 
    image_url?: string; 
    slug?: string;
  };
  view?: 'grid';
  adminPreview?: boolean;
  onPublish?: (eventId: string) => void;
}

// Utility function for date formatting
function formatDateRange(start: string, end: string) {
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  const sd = new Date(start).toLocaleDateString('fr-FR', opt);
  const ed = new Date(end).toLocaleDateString('fr-FR', opt);
  return start === end ? sd : `${sd} – ${ed}`;
}

const EventCard = ({ event, view = 'grid', adminPreview = false, onPublish }: EventCardProps) => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@salonspro.com';

  // Use database-generated slug if available, otherwise fallback to client-generated
  const eventSlug = event.slug || generateEventSlug(event);
  
  // Parse sectors with fallback to prevent crashes
  const eventSectors = React.useMemo(() => {
    if (event.sectors && Array.isArray(event.sectors)) {
      return event.sectors.map(s => s.name || s);
    }
    
    if (typeof event.sector === 'string') {
      try {
        const parsed = JSON.parse(event.sector);
        return Array.isArray(parsed) ? parsed : [event.sector];
      } catch {
        // If JSON parsing fails, try splitting by comma
        return event.sector.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    
    return [];
  }, [event.sectors, event.sector]);

  const CardWrapper = ({ children }: { children: React.ReactNode }) => 
    adminPreview ? (
      <Link to={`/events/${eventSlug}?preview=1`} className="block">
        {children}
      </Link>
    ) : (
      <Link to={`/events/${eventSlug}`} className="block">
        {children}
      </Link>
    );

  return (
    <div className="relative group">
      <Card className={cn(
        "flex flex-col w-full max-w-[272px] overflow-hidden rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] relative event-card",
        !event.visible && isAdmin && "bg-gray-100 opacity-50",
        adminPreview && "border-orange-200"
      )}>
        {/* Badge "Brouillon" pour adminPreview */}
        {adminPreview && (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 z-10 bg-orange-100 text-orange-800 border-orange-300"
            title="Événement en attente de publication"
          >
            Brouillon
          </Badge>
        )}

        {/* Badge "Invisible" pour les événements non visibles en mode admin normal */}
        {!event.visible && isAdmin && !adminPreview && (
          <Badge
            variant="destructive"
            className="absolute top-2 left-2 z-10"
            title="Événement invisible"
          >
            <EyeOff className="h-4 w-4" />
          </Badge>
        )}
        
        <CardWrapper>
          <div className="relative w-full event-card__image-wrapper">
            <img
              src={event.image_url || '/placeholder.svg'}
              alt={`Affiche de ${event.name}`}
              loading="lazy"
              className="event-card__image"
            />
            
            {/* Bouton favoris */}
            {!adminPreview && (
              <FavoriteButton 
                eventId={event.id} 
                size="default"
                variant="overlay"
              />
            )}
            
            {/* Affichage des secteurs sur l'image avec pastilles couleur */}
            <div className="absolute left-2 bottom-2 flex flex-wrap gap-1 max-w-[calc(100%-1rem)]">
              {eventSectors.length > 0 ? (
                eventSectors.slice(0, 2).map((sector, index) => (
                  <SectorBadge 
                    key={`${sector}-${index}`}
                    label={sector}
                    className="shadow-sm"
                  />
                ))
              ) : (
                // Fallback vers l'ancien champ sector si c'est une chaîne simple
                typeof event.sector === 'string' && event.sector && (
                  <SectorBadge 
                    label={event.sector}
                    className="shadow-sm"
                  />
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
        </CardWrapper>
        
        <CardContent className="flex flex-col gap-1 p-4">
          <CardWrapper>
            <h3 className="font-semibold text-lg leading-5 line-clamp-2 hover:text-accent cursor-pointer" title={event.name}>
              {event.name}
            </h3>
          </CardWrapper>
          
          <p className="text-sm text-gray-600">
            {formatDateRange(event.start_date, event.end_date)}
          </p>
          
          <div className="flex items-center text-gray-600 text-sm">
            <MapPin className="h-4 w-4 mr-2 text-accent" />
            <span className="truncate">{event.city}</span>
          </div>
          
          <CardWrapper>
            <Button 
              variant="default" 
              size="sm" 
              className="w-full mt-4 bg-accent hover:bg-accent/90"
            >
              Voir le salon
            </Button>
          </CardWrapper>
        </CardContent>
      </Card>

      {/* Bouton Publier flottant pour adminPreview */}
      {adminPreview && onPublish && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-white text-gray-900 hover:bg-gray-100 shadow-lg"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPublish(event.id);
          }}
        >
          <Eye className="h-4 w-4 mr-2" />
          Publier
        </Button>
      )}
    </div>
  );
};

export default EventCard;
