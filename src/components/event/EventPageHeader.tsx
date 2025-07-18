
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, ExternalLink, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import CalBtn from '@/components/CalBtn';
import FavoriteButton from '@/components/FavoriteButton';
import type { Event } from '@/types/event';
import { useAuth } from '@/contexts/AuthContext';
import { useEventSectors } from '@/hooks/useSectors';
import { getSectorConfig } from '@/constants/sectors';
import { cn } from '@/lib/utils';
import { SectorBadge } from '@/components/ui/sector-badge';

interface EventPageHeaderProps {
  event: Event;
  crmProspects?: Array<{ name: string; stand?: string }>;
}

export const EventPageHeader = ({ event, crmProspects = [] }: EventPageHeaderProps) => {
  const { user } = useAuth();
  const isAdmin = user?.email === 'admin@salonspro.com';
  const { data: eventSectors = [] } = useEventSectors(event.id);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  };

  const official = event.url_site_officiel;

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
          <div className="flex flex-wrap gap-2 mb-6">
            {eventSectors.length > 0 ? (
              eventSectors.map((sector) => (
                <SectorBadge 
                  key={sector.id} 
                  label={sector.name}
                  className="text-sm px-3 py-1"
                />
              ))
            ) : (
              // Fallback vers l'ancien champ secteur si aucun secteur n'est trouvé
              event.secteur && (
                <SectorBadge 
                  label={event.secteur}
                  className="text-sm px-3 py-1"
                />
              )
            )}
          </div>

          {/* Titre principal avec bouton Favoris */}
          <div className="inline-flex items-center space-x-2 mb-6">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight text-left">
              {event.nom_event}
            </h1>
            <FavoriteButton
              eventId={event.id}
              size="xl"
              variant="inline"
            />
          </div>

          {/* Date */}
          <div className="flex items-center text-lg text-gray-600 mb-6">
            <CalendarDays className="h-6 w-6 mr-3 text-accent" />
            <span className="font-medium">
              {formatDate(event.date_debut)}
              {event.date_debut !== event.date_fin && (
                <> - {formatDate(event.date_fin)}</>
              )}
            </span>
          </div>

          {/* Conteneur pour le séparateur et les actions afin de limiter la largeur */}
          <div className="w-fit">
            <Separator className="mb-4" />
            <div className="flex flex-wrap gap-3 items-center">
              {/* Boutons calendrier avec texte explicatif */}
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <CalBtn type="gcal" event={event} crmProspects={crmProspects} />
                  <CalBtn type="outlook" event={event} crmProspects={crmProspects} />
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
