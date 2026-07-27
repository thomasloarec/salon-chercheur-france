import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Lock } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Event } from '@/types/event';

interface AddNoveltyButtonProps {
  event: Event;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  label?: string;
}

export default function AddNoveltyButton({ 
  event, 
  variant = 'default', 
  size = 'default',
  className,
  label
}: AddNoveltyButtonProps) {
  const defaultLabel = 'Exposant ? Ajouter votre nouveauté';
  const navigate = useNavigate();

  // Vérifier si on est en période de pré-lancement (plus de 90 jours avant l'événement)
  const daysUntilEvent = differenceInDays(new Date(event.date_debut), new Date());
  const isPreLaunch = daysUntilEvent > 90;
  const noveltiesOpenDate = new Date(event.date_debut);
  noveltiesOpenDate.setDate(noveltiesOpenDate.getDate() - 90);

  // Vérifier si l'événement est terminé : la publication reste possible
  // jusqu'au dernier jour du salon inclus (date_fin, sinon date_debut).
  // Passée cette date (à partir du lendemain), le bouton disparaît.
  const eventEndDate = new Date(event.date_fin || event.date_debut);
  eventEndDate.setHours(23, 59, 59, 999);
  const isPastEvent = new Date() > eventEndDate;

  const handleClick = () => {
    // Nouveau parcours pleine page (connecté ou non).
    navigate(`/publier-nouveaute/exposant?event=${event.id}`);
  };

  // Événement terminé : on masque complètement le bouton de publication.
  if (isPastEvent) {
    return null;
  }

  // Si période de pré-lancement, afficher bouton désactivé avec tooltip explicatif
  if (isPreLaunch) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button 
                disabled 
                variant={variant}
                size={size}
                className={className}
              >
                <Lock className="h-4 w-4 mr-2" />
                {label || defaultLabel}
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              La publication de nouveautés ouvrira le{' '}
              <strong>{format(noveltiesOpenDate, 'dd MMMM yyyy', { locale: fr })}</strong>
              {' '}(90 jours avant l'événement)
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Bouton normal si période ouverte
  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={className}
    >
      <Plus className="h-4 w-4 mr-2" />
      {label || defaultLabel}
    </Button>
  );
}