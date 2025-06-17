
import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useIsFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import AuthRequiredModal from './AuthRequiredModal';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  eventId: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

const FavoriteButton = ({ eventId, className, size = 'sm' }: FavoriteButtonProps) => {
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

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        onClick={handleClick}
        disabled={toggleFavorite.isPending}
        className={cn(
          "h-8 w-8 p-0 hover:bg-white/20 transition-all duration-200",
          className
        )}
        aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-all duration-200",
            isFavorite
              ? "fill-red-500 text-red-500"
              : "text-white hover:text-red-500",
            toggleFavorite.isPending && "animate-pulse"
          )}
        />
      </Button>

      <AuthRequiredModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />
    </>
  );
};

export default FavoriteButton;
