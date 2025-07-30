
import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import AuthRequiredModal from './AuthRequiredModal';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  eventId: string;       // UUID de l'événement (event.id)
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

  // Size configurations for button container and icon
  const sizeConfig = {
    sm: { container: "w-7 h-7", icon: "h-4 w-4" },
    default: { container: "w-9 h-9", icon: "h-5 w-5" },
    lg: { container: "w-9 h-9", icon: "h-6 w-6" },
    xl: { container: "w-11 h-11", icon: "h-7 w-7" }
  };

  const config = sizeConfig[size];

  // Wrapper classes based on variant
  const wrapperClasses = variant === 'overlay' 
    ? 'absolute top-2 right-2 z-10' 
    : '';

  return (
    <div className={wrapperClasses}>
      <button
        onClick={handleClick}
        disabled={toggleFavorite.isPending}
        aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={cn(
          'inline-flex items-center justify-center rounded-full transition-all duration-200',
          'bg-white hover:bg-red-50 focus:ring-2 focus:ring-red-300 focus:outline-none',
          'shadow-sm hover:shadow-md',
          config.container,
          toggleFavorite.isPending && "animate-pulse",
          className
        )}
      >
        <Heart
          className={cn(
            config.icon,
            "transition-all duration-200",
            isFavorite
              ? "fill-red-500 text-red-500"
              : "text-gray-400 hover:text-red-500"
          )}
        />
      </button>

      <AuthRequiredModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />
    </div>
  );
};

export default FavoriteButton;
