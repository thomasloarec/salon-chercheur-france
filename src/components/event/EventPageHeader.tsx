
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, ExternalLink, EyeOff, Calendar, Building, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import CalBtn from '@/components/CalBtn';
import { useIsFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import { getEventTypeLabel } from '@/constants/eventTypes';
import { formatAffluenceWithSuffix } from '@/utils/affluenceUtils';
import type { Event } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { EventSectors } from '@/components/ui/event-sectors';
import { toast } from 'sonner';

interface EventPageHeaderProps {
  event: Event;
}

export const EventPageHeader = ({ event }: EventPageHeaderProps) => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@lotexpo.com';
  const { data: isFavorite = false } = useIsFavorite(event.id);
  const toggleFavorite = useToggleFavorite();

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  };

  const official = event.url_site_officiel;

  const handleFavoriteClick = async () => {
    try {
      await toggleFavorite.mutateAsync(event.id);
      toast.success(isFavorite ? "Retiré de votre agenda" : "Ajouté à votre agenda");
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error("Une erreur est survenue");
    }
  };

  return (
    <section className={cn(
      "bg-white rounded-lg shadow-sm p-8 mb-8 relative",
      !event.visible && isAdmin && "bg-gray-100 opacity-50"
    )}>
       {!event.visible && isAdmin && (
        <Badge
          variant="destructive"
          className="absolute top-4 right-4 z-10"
          title="Événement invisible"
        >
          <EyeOff className="h-4 w-4" />
        </Badge>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        <div className="flex-1">
          {/* Secteurs d'activité avec pastilles couleur */}
          <EventSectors 
            event={event} 
            className="flex flex-wrap gap-2 mb-6"
            sectorClassName="text-sm px-3 py-1"
          />

          {/* Titre principal */}
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight text-left mb-4">
            {event.nom_event}
          </h1>

          {/* Toutes les infos sur une seule ligne */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-gray-600 mb-6">
            {/* Date */}
            <div className="flex items-center">
              <CalendarDays className="h-4 w-4 mr-2 text-accent flex-shrink-0" />
              <span>
                {formatDate(event.date_debut)}
                {event.date_debut !== event.date_fin && (
                  <> - {formatDate(event.date_fin)}</>
                )}
              </span>
            </div>

            {/* Type */}
            {event.type_event && (
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-accent flex-shrink-0" />
                <span>{getEventTypeLabel(event.type_event)}</span>
              </div>
            )}

            {/* Affluence */}
            {event.affluence && (
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-accent flex-shrink-0" />
                <span>{formatAffluenceWithSuffix(event.affluence)}</span>
              </div>
            )}

            {/* Nom du lieu */}
            {event.nom_lieu && (
              <div className="flex items-center">
                <Building className="h-4 w-4 mr-2 text-accent flex-shrink-0" />
                <span>{event.nom_lieu}</span>
              </div>
            )}
          </div>

          {/* Conteneur pour le séparateur et les actions afin de limiter la largeur */}
          <div className="w-fit">
            <Separator className="mb-4" />
            <div className="flex flex-wrap gap-3 items-center">
              {/* Boutons calendrier avec texte explicatif */}
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Agenda Lotexpo (Favoris) */}
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={handleFavoriteClick}
                    disabled={toggleFavorite.isPending}
                    className={cn(
                      isFavorite && "bg-accent text-white hover:bg-accent/90 border-accent"
                    )}
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Agenda Lotexpo
                  </Button>
                  
                  <CalBtn type="gcal" event={event} />
                  <CalBtn type="outlook" event={event} />
                  {official && (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(official, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Site officiel
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajoutez cet événement à votre agenda en un clic.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Image de l'événement */}
        {event.url_image && (
          <img
            src={event.url_image}
            alt={`Affiche de ${event.nom_event}`}
            loading="lazy"
            className="w-28 sm:w-40 lg:w-48 h-auto object-contain flex-shrink-0 rounded-md shadow-lg"
          />
        )}
      </div>
    </section>
  );
};
