import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Check, Plus, ExternalLink, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToggleRoute } from '@/hooks/useNovelties';
import type { Novelty } from '@/hooks/useNovelties';

interface NoveltyCardProps {
  novelty: Novelty;
  className?: string;
}

const NOVELTY_TYPE_LABELS = {
  Launch: 'Lancement',
  Prototype: 'Prototype',
  MajorUpdate: 'Mise à jour majeure',
  LiveDemo: 'Démo live',
  Partnership: 'Partenariat',
  Offer: 'Offre spéciale',
  Talk: 'Conférence'
};

export default function NoveltyCard({ novelty, className }: NoveltyCardProps) {
  const { user } = useAuth();
  const toggleRoute = useToggleRoute();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const images = novelty.media_urls?.filter(url => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }) || [];

  const hasMultipleImages = images.length > 1;
  const reasons = [novelty.reason_1, novelty.reason_2, novelty.reason_3].filter(Boolean);

  const handleRouteToggle = async () => {
    if (!user) return;
    
    await toggleRoute.mutateAsync({
      event_id: novelty.event_id,
      novelty_id: novelty.id
    });
  };

  const nextImage = () => {
    if (hasMultipleImages) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (hasMultipleImages) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const carousel = carouselRef.current;
      if (!carousel || !hasMultipleImages) return;
      
      // Check if carousel is focused or contains focused element
      const isCarouselFocused = carousel.contains(document.activeElement);
      if (!isCarouselFocused) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevImage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextImage();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasMultipleImages]);

  return (
    <div className={cn("rounded-2xl border shadow-sm p-6 space-y-4 bg-card", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {novelty.exhibitors.logo_url && (
              <img
                src={novelty.exhibitors.logo_url}
                alt={novelty.exhibitors.name}
                className="w-8 h-8 rounded object-cover"
              />
            )}
            <div>
              <Link
                to={`/exposants/${novelty.exhibitors.slug}`}
                className="font-medium hover:underline"
              >
                {novelty.exhibitors.name}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {NOVELTY_TYPE_LABELS[novelty.type] || novelty.type}
                </Badge>
                {novelty.stand_info && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {novelty.stand_info}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <h3 className="text-lg font-semibold leading-tight">{novelty.title}</h3>
        </div>

        {/* Route Toggle Button */}
        <Button
          onClick={handleRouteToggle}
          disabled={!user || toggleRoute.isPending}
          variant={novelty.in_user_route ? "default" : "outline"}
          size="sm"
          className="flex items-center gap-2 min-w-0"
        >
          {novelty.in_user_route ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {novelty.in_user_route ? 'Dans le parcours' : 'Ajouter au parcours'}
          </span>
          <Badge variant="secondary" className="ml-1">
            {novelty.novelty_stats?.route_users_count || 0}
          </Badge>
        </Button>
      </div>

      {/* Media Carousel */}
      {images.length > 0 && (
        <div 
          ref={carouselRef}
          className="relative rounded-lg overflow-hidden bg-muted"
          tabIndex={0}
          data-suppress-global-arrows="true"
        >
          <div className="aspect-[16/9] relative">
            <img
              src={images[currentImageIndex]}
              alt={`${novelty.title} - Image ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
            />
            
            {hasMultipleImages && (
              <>
                {/* Navigation Arrows */}
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                  aria-label="Image suivante"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Dots Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToImage(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        currentImageIndex === index ? "bg-white" : "bg-white/50"
                      )}
                      aria-label={`Aller à l'image ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reasons */}
      {reasons.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">Pourquoi c'est intéressant :</h4>
          <ul className="space-y-1">
            {reasons.map((reason, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-primary font-medium">{index + 1}.</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
        {novelty.availability && (
          <div>
            <h5 className="font-medium text-sm text-muted-foreground mb-1">Disponibilité</h5>
            <p className="text-sm">{novelty.availability}</p>
          </div>
        )}
        
        {novelty.audience_tags && novelty.audience_tags.length > 0 && (
          <div>
            <h5 className="font-medium text-sm text-muted-foreground mb-1">Public cible</h5>
            <div className="flex flex-wrap gap-1">
              {novelty.audience_tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {novelty.doc_url && (
          <div className="sm:col-span-2">
            <a
              href={novelty.doc_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Documentation complémentaire
            </a>
          </div>
        )}
      </div>
    </div>
  );
}