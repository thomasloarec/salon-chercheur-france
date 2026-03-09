
import React, { useState } from 'react';
import { Calendar, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import AuthRequiredModal from './AuthRequiredModal';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FavoriteButtonProps {
  eventId: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
  variant?: 'overlay' | 'inline';
}

const FavoriteButton = ({ 
  eventId, 
  className, 
  size = 'default',
  variant = 'overlay'
}: FavoriteButtonProps) => {
  const { user } = useAuth();
  const { data: isFavorite = false } = useIsFavorite(eventId);
  const toggleFavorite = useToggleFavorite();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      await toggleFavorite.mutateAsync(eventId);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const sizeConfig = {
    sm: { container: "w-7 h-7", icon: "h-4 w-4" },
    default: { container: "w-9 h-9", icon: "h-5 w-5" },
    lg: { container: "w-9 h-9", icon: "h-6 w-6" },
    xl: { container: "w-11 h-11", icon: "h-7 w-7" }
  };

  const config = sizeConfig[size];

  const wrapperClasses = variant === 'overlay' 
    ? 'absolute top-2 right-2 z-10' 
    : '';

  const tooltipText = isFavorite
    ? "Retirer de mon agenda"
    : "Ajouter à mon agenda pour recevoir des rappels";

  return (
    <div className={wrapperClasses}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              disabled={toggleFavorite.isPending}
              aria-label={isFavorite ? "Retirer de mon agenda" : "Ajouter à mon agenda"}
              className={cn(
                'inline-flex items-center justify-center rounded-full transition-all duration-200',
                isFavorite 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-white hover:bg-gray-100',
                'focus:ring-2 focus:ring-green-300 focus:outline-none',
                'shadow-sm hover:shadow-md',
                config.container,
                toggleFavorite.isPending && "animate-pulse",
                className
              )}
            >
              {isFavorite ? (
                <CalendarCheck
                  className={cn(
                    config.icon,
                    "transition-all duration-200 text-white"
                  )}
                />
              ) : (
                <Calendar
                  className={cn(
                    config.icon,
                    "transition-all duration-200 text-gray-500"
                  )}
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent 
            side="bottom" 
            align="end"
            sideOffset={8}
            className="max-w-[260px] text-center text-xs z-[100]"
          >
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AuthRequiredModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />
    </div>
  );
};

export default FavoriteButton;
