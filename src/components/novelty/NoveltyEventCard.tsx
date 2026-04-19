import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  FileText,
  Building2,
  Clock,
  Bookmark,
  Download,
  Images,
  Maximize2,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { useAuth } from '@/contexts/AuthContext';
import {
  useNoveltyLike,
  useNoveltyLikesCount,
  useNoveltyStand,
} from '@/hooks/useNoveltyLike';
import LeadForm from './LeadForm';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import NoveltyDetailDialog from './NoveltyDetailDialog';
import type { Novelty } from '@/hooks/useNovelties';

const TYPE_LABELS: Record<string, string> = {
  Launch: 'Lancement produit',
  Update: 'Mise à jour',
  Demo: 'Démonstration',
  Special_Offer: 'Offre spéciale',
  Partnership: 'Partenariat',
  Innovation: 'Innovation',
};

interface NoveltyEventCardProps {
  novelty: Novelty;
  eventSlug?: string | null;
  eventDateDebut?: string | null;
  eventName?: string | null;
  eventVille?: string | null;
  className?: string;
}

/**
 * Card compacte pour l'affichage des nouveautés sur la page événement.
 * - Format horizontal, image secondaire (jamais dominante).
 * - Pas de commentaires dans le flux principal.
 * - Bouton "M'intéresse" (étoile/signet) — réutilise la même logique
 *   que le like d'origine (useNoveltyLike) pour ne pas casser le mécanisme
 *   lead exposant + agenda utilisateur.
 */
export default function NoveltyEventCard({
  novelty,
  eventSlug,
  eventDateDebut,
  eventName,
  eventVille,
  className,
}: NoveltyEventCardProps) {
  const { user } = useAuth();
  const { isLiked, toggleLike, isPending } = useNoveltyLike(novelty.id);
  const { data: likesCount = 0 } = useNoveltyLikesCount(novelty.id);
  const { data: standInfo } = useNoveltyStand({
    id: novelty.id,
    event_id: novelty.event_id,
    exhibitor_id: novelty.exhibitor_id,
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadFormType, setLeadFormType] =
    useState<'brochure_download' | 'meeting_request'>('brochure_download');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

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
  const image = images[0];
  const imageCount = images.length;
  const logo = getExhibitorLogoUrl(
    (exhibitor as any).logo_url,
    (exhibitor as any).website,
  );

  // Compte à rebours premium "J-X" basé sur la date de l'événement
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

  const description = [novelty.reason_1, novelty.reason_2, novelty.reason_3]
    .filter(Boolean)
    .join(' ');

  // CTA "Voir le détail" : pour l'instant deep-link vers cette même nouveauté
  // sur la page événement (compat. future page dédiée par nouveauté).
  const detailHref = eventSlug
    ? `/events/${eventSlug}?novelty=${novelty.id}`
    : `#novelty-${novelty.id}`;

  const handleInterestToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <>
      <Card
        id={`novelty-${novelty.id}`}
        data-novelty-id={novelty.id}
        className={cn(
          'group overflow-hidden border-border/60 hover:shadow-md hover:border-primary/30 transition-all scroll-mt-24',
          className,
        )}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Visuel compact, jamais dominant — clic = popup détaillé */}
          <button
            type="button"
            onClick={() => setShowDetailDialog(true)}
            className="relative shrink-0 bg-muted overflow-hidden w-full sm:w-44 md:w-48 aspect-[4/3] sm:aspect-[4/5] group/img cursor-zoom-in"
            aria-label={
              imageCount > 1
                ? `Voir les ${imageCount} images de ${novelty.title}`
                : `Voir le détail de ${novelty.title}`
            }
          >
            {image ? (
              <>
                <img
                  src={image}
                  alt={novelty.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover/img:scale-[1.03] transition-transform duration-500"
                />
                {/* Overlay zoom au hover */}
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                  <div className="bg-white/90 text-foreground rounded-full p-2 shadow-md">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                </div>
                {/* Badge nombre d'images si plusieurs */}
                {imageCount > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 tabular-nums">
                    <Images className="h-3 w-3" />
                    {imageCount}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-muted to-muted/40">
                <Building2 className="h-7 w-7 text-muted-foreground/40" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                  {typeLabel}
                </span>
              </div>
            )}
          </button>

          {/* Zone texte */}
          <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col gap-2.5">
            {/* Méta : type + countdown */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-medium">
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

            {/* Titre — clic = popup détaillé */}
            <button
              type="button"
              onClick={() => setShowDetailDialog(true)}
              className="block text-left"
            >
              <h3 className="font-semibold text-base sm:text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors hover:text-primary">
                {novelty.title}
              </h3>
            </button>

            {/* Résumé / description longue avec Voir plus / Voir moins */}
            {description && (
              <div className="text-sm text-muted-foreground leading-relaxed">
                <p className={cn(!isDescriptionExpanded && 'line-clamp-2')}>
                  {description}
                </p>
                {description.length > 140 && (
                  <button
                    type="button"
                    onClick={() => setIsDescriptionExpanded((v) => !v)}
                    className="text-primary hover:underline text-xs font-medium mt-1"
                    aria-expanded={isDescriptionExpanded}
                  >
                    {isDescriptionExpanded ? 'Voir moins' : 'Voir plus'}
                  </button>
                )}
              </div>
            )}

            {/* Séparateur subtil */}
            <div className="h-px bg-border/60" />

            {/* Ligne exposant + stand + signal document */}
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {logo ? (
                  <div className="w-6 h-6 rounded bg-white border flex items-center justify-center shrink-0">
                    <img
                      src={logo}
                      alt={exhibitor.name}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium truncate">
                  {exhibitor.name}
                </span>
                {standInfo && (
                  <span className="text-xs text-primary font-medium shrink-0">
                    · Stand {standInfo}
                  </span>
                )}
              </div>

              {novelty.doc_url && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <FileText className="h-3 w-3" />
                  Document disponible
                </span>
              )}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2 pt-1 mt-auto flex-wrap">

              <Button
                onClick={handleInterestToggle}
                disabled={isPending}
                variant={isLiked ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'gap-1.5',
                  isLiked && 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/15',
                )}
                aria-pressed={isLiked}
                aria-label={isLiked ? 'Retirer de mes intérêts' : "Marquer comme m'intéresse"}
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

              {novelty.doc_url && (
                <Button
                  onClick={handleBrochureDownload}
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  Brochure
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <LeadForm
        isOpen={showLeadForm}
        onClose={() => setShowLeadForm(false)}
        noveltyId={novelty.id}
        leadType={leadFormType}
        brochureUrl={novelty.doc_url}
      />

      <AuthRequiredModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />

      <NoveltyDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        novelty={novelty}
        eventDateDebut={eventDateDebut}
        eventName={eventName}
        eventVille={eventVille}
        standInfo={standInfo}
        likesCount={likesCount}
        isLiked={isLiked}
        onInterestToggle={() => {
          if (!user) {
            setShowAuthModal(true);
            return;
          }
          toggleLike();
        }}
        onBrochureDownload={
          novelty.doc_url ? handleBrochureDownload : undefined
        }
      />
    </>
  );
}
