import React, { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  MapPin,
  Building2,
  FileText,
  Clock,
  Bookmark,
  Download,
  Tag,
  Users,
  CalendarClock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import type { Novelty } from '@/hooks/useNovelties';

const TYPE_LABELS: Record<string, string> = {
  Launch: 'Lancement produit',
  Update: 'Mise à jour',
  Demo: 'Démonstration',
  Special_Offer: 'Offre spéciale',
  Partnership: 'Partenariat',
  Innovation: 'Innovation',
};

interface NoveltyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelty: Novelty;
  /** Date de l'événement pour le countdown J-X. */
  eventDateDebut?: string | null;
  /** Nom de l'événement (affiché dans le bloc contexte). */
  eventName?: string | null;
  /** Ville de l'événement. */
  eventVille?: string | null;
  /** Stand de l'exposant pour cette nouveauté. */
  standInfo?: string | null;
  /** Nombre de "M'intéresse". */
  likesCount?: number;
  isLiked?: boolean;
  onInterestToggle?: () => void;
  onBrochureDownload?: () => void;
  /** Index de l'image affichée à l'ouverture (par défaut 0). */
  initialImageIndex?: number;
}

/**
 * Popup détaillé d'une nouveauté.
 * - Affiche TOUTES les images uploadées en taille (quasi) originale.
 * - Navigation clavier (← →) et flèches.
 * - Conserve toutes les autres infos de la nouveauté (type, countdown,
 *   description complète, exposant, stand, document, audience, dispo, etc.).
 */
export default function NoveltyDetailDialog({
  open,
  onOpenChange,
  novelty,
  eventDateDebut,
  eventName,
  eventVille,
  standInfo,
  likesCount = 0,
  isLiked = false,
  onInterestToggle,
  onBrochureDownload,
  initialImageIndex = 0,
}: NoveltyDetailDialogProps) {
  const exhibitor = novelty.exhibitors ?? {
    id: novelty.exhibitor_id,
    name: 'Exposant',
    slug: '',
    logo_url: undefined,
  };

  const typeLabel = TYPE_LABELS[novelty.type] || novelty.type;

  const images =
    novelty.media_urls?.filter((url) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(url),
    ) ?? [];
  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;

  const [currentIndex, setCurrentIndex] = useState(initialImageIndex);

  // Reset index quand on ouvre / change de nouveauté
  useEffect(() => {
    if (open) {
      setCurrentIndex(
        Math.min(initialImageIndex, Math.max(images.length - 1, 0)),
      );
    }
  }, [open, initialImageIndex, images.length]);

  const next = useCallback(() => {
    if (hasMultipleImages) {
      setCurrentIndex((i) => (i + 1) % images.length);
    }
  }, [hasMultipleImages, images.length]);

  const prev = useCallback(() => {
    if (hasMultipleImages) {
      setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    }
  }, [hasMultipleImages, images.length]);

  // Navigation clavier
  useEffect(() => {
    if (!open || !hasMultipleImages) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hasMultipleImages, next, prev]);

  // Countdown
  const daysUntil = eventDateDebut
    ? differenceInDays(new Date(eventDateDebut), new Date())
    : null;
  const isImminent =
    daysUntil !== null && daysUntil >= 0 && daysUntil <= 14;
  const countdownLabel =
    daysUntil === null
      ? null
      : daysUntil <= 0
        ? 'En cours'
        : daysUntil === 1
          ? 'J-1'
          : `J-${daysUntil}`;

  const description = [
    novelty.reason_1,
    novelty.reason_2,
    novelty.reason_3,
  ]
    .filter(Boolean)
    .join('\n\n');

  const logo = getExhibitorLogoUrl(
    (exhibitor as any).logo_url,
    (exhibitor as any).website,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-[95vw] p-0 overflow-hidden gap-0 max-h-[92vh]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>{novelty.title}</DialogTitle>
          <DialogDescription>
            Détail de la nouveauté {novelty.title} de {exhibitor.name}
          </DialogDescription>
        </VisuallyHidden>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] max-h-[92vh]">
          {/* Colonne images : taille (quasi) originale, fond sombre, scroll si besoin */}
          <div className="relative bg-neutral-950 flex items-center justify-center min-h-[260px] md:min-h-[500px] md:max-h-[92vh]">
            {hasImages ? (
              <>
                <img
                  src={images[currentIndex]}
                  alt={`${novelty.title} — image ${currentIndex + 1}`}
                  className="max-w-full max-h-[60vh] md:max-h-[92vh] object-contain"
                />

                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Image précédente"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Image suivante"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {/* Compteur */}
                    <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-full tabular-nums">
                      {currentIndex + 1} / {images.length}
                    </div>

                    {/* Miniatures */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90%] overflow-x-auto px-2 py-1 bg-black/40 rounded-full">
                      {images.map((url, i) => (
                        <button
                          key={url + i}
                          type="button"
                          onClick={() => setCurrentIndex(i)}
                          aria-label={`Image ${i + 1}`}
                          className={cn(
                            'w-10 h-10 rounded-md overflow-hidden border-2 shrink-0 transition-all',
                            i === currentIndex
                              ? 'border-white opacity-100'
                              : 'border-transparent opacity-60 hover:opacity-100',
                          )}
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-white/60 p-8">
                <Building2 className="h-10 w-10" />
                <span className="text-sm">Aucune image</span>
              </div>
            )}
          </div>

          {/* Colonne infos : toutes les données de la nouveauté */}
          <div className="overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* Bouton fermer custom (en plus du X par défaut du Dialog) */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fermer"
              className="md:hidden absolute top-2 right-2 z-10 bg-background/80 backdrop-blur p-1.5 rounded-full border"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Méta : type + countdown */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-medium">
                <Tag className="h-3 w-3 mr-1" />
                {typeLabel}
              </Badge>
              {countdownLabel && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border tabular-nums',
                    isImminent
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-foreground/80 border-border',
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {countdownLabel}
                </span>
              )}
            </div>

            {/* Titre */}
            <h2 className="text-xl sm:text-2xl font-semibold leading-snug">
              {novelty.title}
            </h2>

            {/* Description complète */}
            {description && (
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {description}
              </div>
            )}

            {/* Résumé court (summary) si différent et présent */}
            {(novelty as any).summary &&
              (novelty as any).summary !== description && (
                <div className="text-sm text-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-3">
                  {(novelty as any).summary}
                </div>
              )}

            {/* Détails additionnels */}
            {(novelty as any).details && (
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {(novelty as any).details}
              </div>
            )}

            <div className="h-px bg-border" />

            {/* Exposant */}
            <div className="flex items-center gap-3">
              {logo ? (
                <div className="w-10 h-10 rounded bg-white border flex items-center justify-center shrink-0">
                  <img
                    src={logo}
                    alt={exhibitor.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">
                  {exhibitor.name}
                </div>
                {standInfo && (
                  <div className="text-xs text-primary font-medium">
                    Stand {standInfo}
                  </div>
                )}
              </div>
            </div>

            {/* Contexte salon */}
            {(eventName || eventDateDebut || eventVille) && (
              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
                {eventName && (
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                    <span className="truncate">{eventName}</span>
                  </div>
                )}
                <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground flex-wrap pl-5">
                  {eventDateDebut && (
                    <span>
                      {format(new Date(eventDateDebut), 'dd MMM yyyy', {
                        locale: fr,
                      })}
                    </span>
                  )}
                  {eventVille && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {eventVille}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Disponibilité */}
            {novelty.availability && (
              <div className="flex items-start gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    Disponibilité
                  </div>
                  <div>{novelty.availability}</div>
                </div>
              </div>
            )}

            {/* Public cible */}
            {novelty.audience_tags && novelty.audience_tags.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Public cible
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {novelty.audience_tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Document disponible */}
            {novelty.doc_url && (
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <FileText className="h-4 w-4" />
                Document disponible
              </div>
            )}

            {/* CTA */}
            <div className="flex items-center gap-2 pt-2 flex-wrap sticky bottom-0 bg-background pb-1">
              {onInterestToggle && (
                <Button
                  onClick={onInterestToggle}
                  variant={isLiked ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'gap-1.5',
                    isLiked &&
                      'bg-primary/10 text-primary border-primary/30 hover:bg-primary/15',
                  )}
                  aria-pressed={isLiked}
                >
                  <Bookmark
                    className={cn('h-3.5 w-3.5', isLiked && 'fill-current')}
                  />
                  {isLiked ? 'Intéressé·e' : "M'intéresse"}
                  {likesCount > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      · {likesCount}
                    </span>
                  )}
                </Button>
              )}

              {novelty.doc_url && onBrochureDownload && (
                <Button
                  onClick={onBrochureDownload}
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Brochure
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
