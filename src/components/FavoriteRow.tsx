
import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ChevronRight, Heart } from 'lucide-react';
import { SiGooglecalendar, SiMicrosoftoutlook } from "react-icons/si";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateRange } from '@/utils/dateUtils';
import { useToggleFavorite } from '@/hooks/useFavorites';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getGoogleCalUrl, getOutlookCalUrl } from '@/lib/calendar-links';
import type { Event } from '@/types/event';

interface FavoriteRowProps {
  event: Event;
  onRemove?: () => void;
}

const FavoriteRow = ({ event, onRemove }: FavoriteRowProps) => {
  const toggleFavorite = useToggleFavorite();
  const { toast } = useToast();

  const handleRemoveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await toggleFavorite.mutateAsync(event.id);
      
      toast({
        title: "Événement retiré de votre agenda",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await toggleFavorite.mutateAsync(event.id);
            }}
          >
            Annuler
          </Button>
        ),
      });

      onRemove?.();
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast({
        title: "Erreur",
        description: "Impossible de retirer l'événement de votre agenda",
        variant: "destructive",
      });
    }
  };

  // Fonction utilitaire pour formater le secteur
  const formatSector = (secteur: string | string[]) => {
    if (!secteur) return null;
    
    let sectors = [];
    
    if (Array.isArray(secteur)) {
      sectors = secteur;
    } else if (typeof secteur === 'string') {
      // Si c'est une string qui contient du JSON
      if (secteur.startsWith('[') && secteur.endsWith(']')) {
        try {
          const parsed = JSON.parse(secteur);
          sectors = Array.isArray(parsed) ? parsed : [secteur];
        } catch {
          sectors = [secteur];
        }
      } else {
        sectors = [secteur];
      }
    }
    
    // Nettoyer les secteurs en retirant les crochets supplémentaires
    return sectors
      .map(s => typeof s === 'string' ? s.replace(/^\["|"\]$/g, '').replace(/"/g, '') : s)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="favorite-row flex items-center gap-3 py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors group">
      <Link
        to={`/events/${event.slug}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {/* Thumbnail */}
        {event.url_image ? (
          <img
            src={event.url_image}
            alt={`Affiche de ${event.nom_event}`}
            className="h-14 w-14 rounded-md object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-14 w-14 rounded-md bg-gray-200 flex items-center justify-center flex-shrink-0">
            <Calendar className="h-6 w-6 text-gray-400" />
          </div>
        )}

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <p className="event-title font-medium truncate text-gray-900 group-hover:text-primary transition-colors">
            {event.nom_event}
          </p>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateRange(event.date_debut, event.date_fin)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.ville}
            </span>
            {event.secteur && (
              <Badge variant="outline" className="text-xs">
                {formatSector(event.secteur)}
              </Badge>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
      </Link>

      {/* Calendar buttons */}
      <div className="flex gap-2 ml-auto flex-shrink-0">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={getGoogleCalUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ajouter à Google Calendar"
                className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm p-1 transition-opacity"
              >
                <SiGooglecalendar className="w-5 h-5 text-[#4285F4]" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">Google Calendar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={getOutlookCalUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ajouter à Microsoft Outlook"
                className="hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm p-1 transition-opacity"
              >
                <SiMicrosoftoutlook className="w-5 h-5 text-[#0072C6]" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">Outlook</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleRemoveClick}
        disabled={toggleFavorite.isPending}
        aria-label="Retirer de l'agenda"
        className="flex-shrink-0"
      >
        <Heart
          className={cn(
            'w-5 h-5 fill-red-500 text-red-500',
            toggleFavorite.isPending && 'animate-pulse'
          )}
        />
      </Button>
    </div>
  );
};

export default FavoriteRow;
