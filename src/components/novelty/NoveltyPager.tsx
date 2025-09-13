import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoveltyPagerProps {
  currentIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

export default function NoveltyPager({
  currentIndex,
  total,
  onPrevious,
  onNext,
  className
}: NoveltyPagerProps) {
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < total - 1;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no element with data-suppress-global-arrows is focused
      const activeElement = document.activeElement;
      if (activeElement?.closest('[data-suppress-global-arrows]')) {
        return;
      }

      if (e.key === 'ArrowLeft' && canGoPrevious) {
        e.preventDefault();
        onPrevious();
      } else if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault();
        onNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canGoPrevious, canGoNext, onPrevious, onNext]);

  if (total <= 1) return null;

  return (
    <div className={cn(
      "flex items-center justify-center gap-4 p-4",
      className
    )}>
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Précédent
      </Button>

      <div 
        className="text-sm text-muted-foreground min-w-fit"
        role="status"
        aria-live="polite"
        aria-label={`Nouveauté ${currentIndex + 1} sur ${total}`}
      >
        <span className="font-medium">{currentIndex + 1}</span>
        <span className="mx-1">/</span>
        <span>{total}</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!canGoNext}
        className="flex items-center gap-2"
      >
        Suivant
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}