
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

import { cn } from '@/lib/utils';
import FavoriteButton from './FavoriteButton';
import { EventSectors } from '@/components/ui/event-sectors';
import { formatAddress } from '@/utils/formatAddress';

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
  const isAdmin = user?.email === 'admin@lotexpo.com';

  // Use database-generated slug (tous les événements en ont un maintenant)
  const eventSlug = event.slug;


  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
    if (adminPreview) {
      // Pour les événements en attente, utiliser l'ID direct pour la page d'admin
      return (
        <Link to={`/admin/events/${event.id}`} className="block">
          {children}
        </Link>
      );
    } else {
      return (
        <Link to={`/events/${eventSlug}`} className="block">
          {children}
        </Link>
      );
    }
  };

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
            En attente
          </Badge>
        )}

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
            {/* Overlay sombre pour les événements en attente */}
            {adminPreview && (
              <div className="absolute inset-0 bg-black/20 z-[1] transition-opacity group-hover:bg-black/10" />
            )}
            
            <img
              src={event.url_image || '/placeholder.svg'}
              alt={`Affiche de ${event.nom_event || 'Événement'}`}
              loading="lazy"
              className="event-card__image"
            />
            
            {!adminPreview && (
              <FavoriteButton 
                eventId={event.id} 
                size="default"
                variant="overlay"
              />
            )}
            
            <div className="absolute left-2 bottom-2 flex flex-wrap gap-1 max-w-[calc(100%-1rem)] z-[2]">
              <EventSectors event={event} sectorClassName="shadow-sm" />
            </div>
          </div>
        </CardWrapper>
        
        <CardContent className="flex flex-col gap-1 p-4">
          <CardWrapper>
            <h3 className="font-semibold text-lg leading-5 line-clamp-2 hover:text-accent cursor-pointer" title={event.nom_event}>
              {event.nom_event}
            </h3>
          </CardWrapper>
          
          <p className="text-sm text-gray-600">
            {formatDateRange(event.date_debut, event.date_fin)}
          </p>
          
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <MapPin className="h-4 w-4 shrink-0" />
            {formatAddress(event.rue, event.code_postal, event.ville) || '—'}
          </p>
          
          <CardWrapper>
            <Button 
              variant="default" 
              size="sm" 
              className="w-full mt-4 bg-accent hover:bg-accent/90"
            >
              {adminPreview ? 'Voir / Éditer' : 'Voir le salon'}
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
