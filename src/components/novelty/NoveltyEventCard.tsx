import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Building2,
  Clock,
  MapPin,
  Download,
  Images,
  Check,
  CalendarCheck,
  Link2,
  MoreHorizontal,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { ExhibitorDetailDialog } from '@/components/event/ExhibitorDetailDialog';
import type { Novelty } from '@/hooks/useNovelties';
import type { Event } from '@/types/event';
import {
  fetchExhibitorPublicSlugs,
  resolvePublicSlug,
  type PublicSlugInfo,
} from '@/lib/exhibitorPublicSlug';

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
  /** Event complet (pour ouvrir la fiche exposant depuis le détail). */
  event?: Event;
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
  event,
  className,
}: NoveltyEventCardProps) {
  const { user } = useAuth();
  const { isLiked, toggleLike, isPending } = useNoveltyLike(
    novelty.id,
    novelty.event_id,
  );
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
  const [showExhibitorDialog, setShowExhibitorDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  // Phase 4B — public profile slug resolved on demand (single batched query).
  const [exhibitorSlugInfo, setExhibitorSlugInfo] = useState<PublicSlugInfo | null>(null);

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
    .join('\n\n');

  // Lien crawlable vers la page dédiée de la nouveauté (remplace le popup).
  const detailHref = novelty.slug
    ? `/nouveautes/${novelty.slug}`
    : eventSlug
      ? `/events/${eventSlug}?novelty=${novelty.id}`
      : `#novelty-${novelty.id}`;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!novelty.slug) return;
    try {
      await navigator.clipboard.writeText(`https://lotexpo.com/nouveautes/${novelty.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

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

  const handleMeetingRequest = () => {
    setLeadFormType('meeting_request');
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
          {/* Visuel — clic = navigation crawlable vers la page nouveauté */}
          <Link
            to={detailHref}
            className="relative shrink-0 bg-muted overflow-hidden w-full sm:w-44 md:w-48 aspect-[4/3] sm:aspect-[4/5] group/img"
            aria-label={`Voir le détail de ${novelty.title}`}
          >
            {image ? (
              <>
                <img
                  src={image}
                  alt={novelty.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover/img:scale-[1.03] transition-transform duration-500"
                />
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
          </Link>

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

            {/* Titre — clic = navigation crawlable vers la page nouveauté */}
            <Link to={detailHref} className="block text-left">
              <h3 className="font-semibold text-base sm:text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors hover:text-primary">
                {novelty.title}
              </h3>
            </Link>

            {/* Résumé / description longue avec Voir plus / Voir moins */}
            {description && (
              <div className="text-sm text-muted-foreground leading-relaxed">
                <p
                  className={cn(
                    'whitespace-pre-line',
                    !isDescriptionExpanded && 'line-clamp-5',
                  )}
                >
                  {description}
                </p>
                {description.length > 280 && (
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
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!event) return;
                    setShowExhibitorDialog(true);
                    if (!exhibitorSlugInfo && novelty.exhibitor_id) {
                      const maps = await fetchExhibitorPublicSlugs(
                        [novelty.exhibitor_id],
                        [novelty.exhibitor_id],
                      );
                      const info = resolvePublicSlug(maps, {
                        exhibitorId: novelty.exhibitor_id,
                        legacyId: novelty.exhibitor_id,
                      });
                      if (info) setExhibitorSlugInfo(info);
                    }
                  }}
                  disabled={!event}
                  className={cn(
                    'flex items-center gap-2 min-w-0 rounded px-1 -mx-1 py-0.5 transition-colors',
                    event
                      ? 'hover:bg-muted cursor-pointer'
                      : 'cursor-default',
                  )}
                  aria-label={
                    event
                      ? `Voir la fiche de ${exhibitor.name}`
                      : exhibitor.name
                  }
                >
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
                  <span
                    className={cn(
                      'text-sm font-medium truncate',
                      event && 'text-primary hover:underline',
                    )}
                  >
                    {exhibitor.name}
                  </span>
                </button>
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
              {/* CTA principal — Demander un rendez-vous (chaîne de lead) */}
              <Button
                onClick={handleMeetingRequest}
                size="sm"
                className="gap-1.5"
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Demander un rendez-vous
              </Button>

              {/* Secondaire — Télécharger la brochure (uniquement si PDF) */}
              {novelty.doc_url && (
                <Button
                  onClick={handleBrochureDownload}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-accent/40 bg-accent/10 text-accent hover:bg-accent hover:text-accent-foreground hover:border-accent"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger la brochure
                </Button>
              )}

              {/* Stands à voir — bouton secondaire outline explicite (icône + texte) */}
              <Button
                onClick={handleInterestToggle}
                disabled={isPending}
                variant="outline"
                size="sm"
                className={cn(
                  'gap-1.5',
                  isLiked &&
                    'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                )}
                aria-pressed={isLiked}
                aria-label={isLiked ? 'Retirer de mes stands à voir' : 'Ajouter à mes stands à voir'}
              >
                <MapPin
                  className={cn('h-3.5 w-3.5', isLiked && 'fill-current')}
                />
                {isLiked ? 'Dans vos stands à voir' : 'Stands à voir'}
                {likesCount > 0 && (
                  <span className="text-xs tabular-nums opacity-70">{likesCount}</span>
                )}
              </Button>

              {/* Menu "···" — actions secondaires (copier le lien) */}
              {novelty.slug && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-8 w-8 text-muted-foreground"
                      aria-label="Plus d'actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => handleCopyLink(e as unknown as React.MouseEvent)}
                    >
                      {copied ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <Link2 className="mr-2 h-4 w-4" />
                      )}
                      {copied ? 'Lien copié' : 'Copier le lien'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

      {event && (
        <ExhibitorDetailDialog
          open={showExhibitorDialog}
          onOpenChange={setShowExhibitorDialog}
          event={event}
          exhibitor={{
            id_exposant: novelty.exhibitor_id,
            exhibitor_uuid: novelty.exhibitor_id,
            exhibitor_name: exhibitor.name,
            name_final: exhibitor.name,
            logo_url: (exhibitor as any).logo_url,
            website_exposant: (exhibitor as any).website,
            website_final: (exhibitor as any).website,
            stand_exposant: standInfo || undefined,
            public_slug: exhibitorSlugInfo?.public_slug ?? null,
            seo_indexable: exhibitorSlugInfo?.seo_indexable,
            is_test: exhibitorSlugInfo?.is_test,
          }}
        />
      )}
    </>
  );
}
