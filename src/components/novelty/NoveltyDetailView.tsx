import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Building2,
  Clock,
  FileText,
  Download,
  CalendarCheck,
  ChevronRight,
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';
import { NOVELTY_TYPE_LABELS } from '@/hooks/useNoveltyPublic';
import { cn } from '@/lib/utils';

function isImage(url: string) {
  return /^blob:|^data:image\//i.test(url) || /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url);
}

/**
 * Forme minimale nécessaire à l'affichage. Compatible PublicNovelty, mais
 * aussi avec un objet construit en mémoire (atelier de publication).
 */
export interface NoveltyDetailViewNovelty {
  title: string;
  type: string;
  reason_1?: string | null;
  reason_2?: string | null;
  reason_3?: string | null;
  summary?: string | null;
  details?: string | null;
  media_urls?: string[] | null;
  doc_url?: string | null;
  resource_url?: string | null;
  stand_info?: string | null;
  exhibitor_display_name?: string | null;
  exhibitor_logo_url?: string | null;
  exhibitor_public_slug?: string | null;
  event_slug?: string | null;
  event_name?: string | null;
  event_date_debut?: string | null;
  event_ville?: string | null;
}

export interface NoveltyDetailViewProps {
  novelty: NoveltyDetailViewNovelty;
  /** Nombre de « stands à voir ». Masqué si 0 ou non fourni. */
  likesCount?: number;
  isLiked?: boolean;
  onInterestToggle?: () => void;
  interestPending?: boolean;
  onRequestMeeting?: () => void;
  onDownloadBrochure?: () => void;
  /** Zone d'actions à droite des badges (menu « copier le lien » par ex.). */
  headerActions?: ReactNode;
  /**
   * Mode aperçu : aucun lien n'est cliquable, les boutons de la carte CTA sont
   * inertes, et des textes d'attente remplacent les champs vides.
   */
  preview?: boolean;
  className?: string;
}

/**
 * Présentation pure de la page « Nouveauté » (deux colonnes : visuel à gauche,
 * texte à droite). AUCUN hook de requête ici : toutes les données arrivent en
 * props, ce qui permet de réutiliser le même rendu dans l'atelier de création.
 */
export default function NoveltyDetailView({
  novelty,
  likesCount = 0,
  isLiked = false,
  onInterestToggle,
  interestPending = false,
  onRequestMeeting,
  onDownloadBrochure,
  headerActions,
  preview = false,
  className,
}: NoveltyDetailViewProps) {
  const typeLabel = NOVELTY_TYPE_LABELS[novelty.type] || novelty.type;
  const images = (novelty.media_urls ?? []).filter((u) => u && isImage(u)) as string[];
  const logo = getExhibitorLogoUrl(novelty.exhibitor_logo_url ?? undefined, undefined);
  const exhibitorName = novelty.exhibitor_display_name || 'Exposant';
  const imgAlt = `${novelty.title} – ${exhibitorName}`;

  const reasons = [novelty.reason_1, novelty.reason_2, novelty.reason_3].filter(
    Boolean,
  ) as string[];

  const daysUntil = novelty.event_date_debut
    ? differenceInDays(new Date(novelty.event_date_debut), new Date())
    : null;
  const isImminent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 14;
  const countdownLabel =
    daysUntil === null
      ? null
      : daysUntil <= 0
        ? 'En cours'
        : daysUntil === 1
          ? 'J-1'
          : `J-${daysUntil}`;

  const isPastEvent = novelty.event_date_debut
    ? new Date(novelty.event_date_debut).getTime() < new Date().setHours(0, 0, 0, 0)
    : false;

  const hasBrochure = !!(novelty.doc_url || novelty.resource_url);

  return (
    <div className={cn('grid grid-cols-1 gap-8 lg:grid-cols-2', className)}>
      {/* LEFT — image carousel, original aspect, capped height on mobile */}
      <div className={cn(!preview && 'lg:sticky lg:top-24 lg:self-start')}>
        {images.length > 0 ? (
          <Carousel className="w-full" opts={{ loop: images.length > 1 }}>
            <CarouselContent>
              {images.map((src, i) => (
                <CarouselItem key={src}>
                  <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-xl border bg-muted lg:max-h-none">
                    <img
                      src={src}
                      alt={images.length > 1 ? `${imgAlt} (${i + 1}/${images.length})` : imgAlt}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      className="max-h-[60vh] w-auto max-w-full object-contain lg:max-h-[72vh]"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border bg-gradient-to-br from-muted to-muted/40">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            {preview && (
              <span className="text-xs text-muted-foreground/70">
                Votre image apparaîtra ici
              </span>
            )}
          </div>
        )}
      </div>

      {/* RIGHT — vertical details column */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-medium">{typeLabel}</Badge>
          {countdownLabel && (
            <span
              className={
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ' +
                (isImminent
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-foreground/80')
              }
            >
              <Clock className="h-3 w-3" />
              {countdownLabel}
            </span>
          )}
          {headerActions && <div className="ml-auto">{headerActions}</div>}
        </div>

        <h1
          className={cn(
            'heading-display text-2xl font-bold leading-tight tracking-tight md:text-3xl',
            preview && !novelty.title && 'font-normal italic text-muted-foreground/50',
          )}
        >
          {novelty.title || (preview ? 'Votre titre apparaîtra ici' : '')}
        </h1>

        {/* Exhibitor */}
        <div className="flex items-center gap-3">
          {logo ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-white">
              <img src={logo} alt={exhibitorName} className="max-h-full max-w-full object-contain" loading="lazy" />
            </span>
          ) : (
            <Building2 className="h-8 w-8 shrink-0 text-muted-foreground" />
          )}
          {novelty.exhibitor_public_slug && !preview ? (
            <Link
              to={`/exposants/${novelty.exhibitor_public_slug}`}
              className="font-semibold text-primary hover:underline"
            >
              {exhibitorName}
            </Link>
          ) : (
            <span className="font-semibold">{exhibitorName}</span>
          )}
          {novelty.stand_info && (
            <span className="text-sm text-primary font-medium">· Stand {novelty.stand_info}</span>
          )}
        </div>

        {/* Reasons to visit */}
        {reasons.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pourquoi c'est intéressant
            </h2>
            <ul className="space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span className="whitespace-pre-line">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : preview ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pourquoi c'est intéressant
            </h2>
            <p className="text-sm italic text-muted-foreground/50">
              Votre texte « pourquoi venir la voir » apparaîtra ici.
            </p>
          </div>
        ) : null}

        {/* Summary / details */}
        {(novelty.summary || novelty.details) && (
          <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
            {novelty.summary && <p className="whitespace-pre-line font-medium">{novelty.summary}</p>}
            {novelty.details && <p className="whitespace-pre-line text-muted-foreground">{novelty.details}</p>}
          </div>
        )}

        {/* Lead capture */}
        {!isPastEvent && (
          <Card className="space-y-3 border-primary/20 bg-primary/[0.03] p-4">
            <p className="text-sm font-medium">Intéressé·e par cette nouveauté ?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={preview ? undefined : onRequestMeeting}
                disabled={preview}
                className="gap-1.5"
              >
                <CalendarCheck className="h-4 w-4" />
                Demander un rendez-vous
              </Button>
              {hasBrochure && (
                <Button
                  variant="outline"
                  onClick={preview ? undefined : onDownloadBrochure}
                  disabled={preview}
                  className="gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
                >
                  <Download className="h-4 w-4" />
                  Télécharger la brochure
                </Button>
              )}
              <Button
                onClick={preview ? undefined : onInterestToggle}
                disabled={preview || interestPending}
                variant="outline"
                className={cn(
                  'gap-1.5',
                  isLiked &&
                    'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                )}
                aria-pressed={isLiked}
                aria-label={isLiked ? 'Retirer de mes stands à voir' : 'Ajouter à mes stands à voir'}
              >
                <MapPin className={cn('h-4 w-4', isLiked && 'fill-current')} />
                {isLiked ? 'Dans vos stands à voir' : 'Stand à voir'}
                {likesCount > 0 && (
                  <span className="text-xs tabular-nums opacity-70">{likesCount}</span>
                )}
              </Button>
            </div>
            {hasBrochure && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" /> Document disponible
              </p>
            )}
          </Card>
        )}

        {/* Event block */}
        {novelty.event_name &&
          (() => {
            const inner = (
              <>
                <Calendar className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">{novelty.event_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {novelty.event_date_debut && (
                      <>{format(new Date(novelty.event_date_debut), 'dd MMM yyyy', { locale: fr })}</>
                    )}
                    {novelty.event_ville && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {novelty.event_ville}
                      </span>
                    )}
                  </p>
                </div>
              </>
            );
            if (novelty.event_slug && !preview) {
              return (
                <Link
                  to={`/events/${novelty.event_slug}`}
                  className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  {inner}
                </Link>
              );
            }
            return <div className="flex items-start gap-3 rounded-lg border p-4">{inner}</div>;
          })()}
      </div>
    </div>
  );
}