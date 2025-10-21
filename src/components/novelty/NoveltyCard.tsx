import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, MapPin, Heart, Download, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNoveltyLike, useNoveltyLikesCount } from '@/hooks/useNoveltyLike';
import LeadForm from './LeadForm';
import { ExhibitorDetailDialog } from '@/components/event/ExhibitorDetailDialog';
import AuthRequiredModal from '@/components/AuthRequiredModal';
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
  const { isLiked, toggleLike, isPending } = useNoveltyLike(novelty.id);
  const { data: likesCount } = useNoveltyLikesCount(novelty.id);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showExhibitorModal, setShowExhibitorModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [leadFormType, setLeadFormType] = useState<'brochure_download' | 'meeting_request'>('brochure_download');
  const carouselRef = useRef<HTMLDivElement>(null);

  const images = novelty.media_urls?.filter(url => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }) || [];

  const hasMultipleImages = images.length > 1;
  const description = [novelty.reason_1, novelty.reason_2, novelty.reason_3].filter(Boolean).join(' ');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const handleLikeToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Éviter de déclencher d'autres actions
    
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    toggleLike();
  };

  const handleBrochureDownload = () => {
    setLeadFormType('brochure_download');
    setShowLeadForm(true);
  };

  const handleMeetingRequest = () => {
    setLeadFormType('meeting_request');
    setShowLeadForm(true);
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
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold leading-tight">{novelty.title}</h3>
            <Badge variant="outline" className="text-xs">
              {NOVELTY_TYPE_LABELS[novelty.type] || novelty.type}
            </Badge>
          </div>
          
          {/* Exhibitor info */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowExhibitorModal(true)}
              className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors"
            >
              {novelty.exhibitors.logo_url ? (
                <img
                  src={novelty.exhibitors.logo_url}
                  alt={novelty.exhibitors.name}
                  className="w-8 h-8 rounded object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium">
                    {novelty.exhibitors.name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="font-medium text-sm hover:underline">
                {novelty.exhibitors.name}
              </span>
            </button>
            
            {novelty.stand_info && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {novelty.stand_info}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p className={cn(!isDescriptionExpanded && "line-clamp-2")}>
            {description}
          </p>
          {description.length > 150 && (
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="text-primary hover:underline text-sm mt-1 font-medium"
            >
              {isDescriptionExpanded ? 'Voir moins' : 'Voir plus...'}
            </button>
          )}
        </div>
      )}

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
              className="w-full h-full object-contain"
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

      {/* Additional Info */}
      {(novelty.availability || (novelty.audience_tags && novelty.audience_tags.length > 0)) && (
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
        </div>
      )}

      {/* CTA Buttons - Always visible */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleLikeToggle}
            variant={isLiked ? "default" : "outline"}
            size="sm"
            disabled={isPending}
            className="flex items-center gap-2"
          >
            <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
            <span>{likesCount || 0}</span>
          </Button>

          {novelty.doc_url && (
            <Button
              onClick={handleBrochureDownload}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Brochure
            </Button>
          )}

          <Button
            onClick={handleMeetingRequest}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            RDV
          </Button>
        </div>
      </div>

      {/* Lead Form Modal */}
      <LeadForm
        isOpen={showLeadForm}
        onClose={() => setShowLeadForm(false)}
        noveltyId={novelty.id}
        leadType={leadFormType}
        brochureUrl={novelty.doc_url}
      />

      {/* Exhibitor Detail Dialog */}
      <ExhibitorDetailDialog
        open={showExhibitorModal}
        onOpenChange={setShowExhibitorModal}
        exhibitor={{
          id_exposant: novelty.exhibitors.id,
          exhibitor_name: novelty.exhibitors.name,
          logo_url: novelty.exhibitors.logo_url,
          stand_exposant: novelty.stand_info,
        }}
        event={{
          id: novelty.events?.id || novelty.event_id,
          slug: novelty.events?.slug || '',
          nom_event: novelty.events?.nom_event || '',
        } as any}
      />

      {/* Auth Required Modal */}
      <AuthRequiredModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />
    </div>
  );
}