import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarDays,
  ExternalLink,
  EyeOff,
  Calendar,
  Building,
  MapPin,
  Sparkles,
  ChevronDown,
  CalendarCheck,
  ImageOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsFavorite, useToggleFavorite } from '@/hooks/useFavorites';
import { getEventTypeLabel } from '@/constants/eventTypes';
import type { Event } from '@/types/event';
import {
  isEventPast as isEventPastFn,
} from '@/lib/eventCapabilities';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useEventSectors } from '@/hooks/useSectors';
import { toast } from 'sonner';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { format as formatDateFn, addDays } from 'date-fns';

interface EventPageHeaderProps {
  event: Event;
  /** Le CTA Parcours IA n'est rendu que si true (capabilities.canPrepareVisit). */
  canPrepareVisit?: boolean;
  /** Ouvre l'unique instance du PrepareVisitWizard, portée par EventPageContent. */
  onPrepareVisit?: () => void;
}

/** Secteur principal, résolu comme EventSectors (table normalisée puis colonne secteur). */
function useMainSector(event: Event): string | null {
  const { data: eventSectors = [] } = useEventSectors(event.id_event || '');
  if (eventSectors.length > 0) return eventSectors[0]?.name ?? null;
  const raw = event.secteur;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw.flat().find((s) => typeof s === 'string' && s.trim());
    return (first as string) ?? null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const first = Array.isArray(parsed) ? parsed.flat().find(Boolean) : null;
        return typeof first === 'string' ? first : null;
      } catch {
        return trimmed || null;
      }
    }
    return trimmed.split(',')[0]?.trim() || null;
  }
  return null;
}

export const EventPageHeader = ({
  event,
  canPrepareVisit = false,
  onPrepareVisit,
}: EventPageHeaderProps) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: isFavorite = false } = useIsFavorite(event.id);
  const toggleFavorite = useToggleFavorite();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const mainSector = useMainSector(event);

  const isEventPast = isEventPastFn(event.date_debut, event.date_fin);

  const formatDate = (dateStr: string) => format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });

  const official = event.url_site_officiel;

  const handleFavoriteClick = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    try {
      await toggleFavorite.mutateAsync(event.id);
      toast.success(isFavorite ? 'Retiré de votre agenda' : 'Ajouté à votre agenda');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Une erreur est survenue');
    }
  };

  // Liens calendrier — logique identique à CalBtn (all-day, fin exclusive).
  const openCalendar = (type: 'gcal' | 'outlook') => {
    const start = new Date(event.date_debut);
    const endExclusive = addDays(new Date(event.date_fin), 1);
    const details = event.description_event || '';
    const encodedTitle = encodeURIComponent(event.nom_event);
    const encodedLocation = encodeURIComponent(
      `${event.nom_lieu || ''} ${event.rue || ''} ${event.ville}`.trim(),
    );

    if (type === 'gcal') {
      const url =
        `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}` +
        `&dates=${formatDateFn(start, 'yyyyMMdd')}/${formatDateFn(endExclusive, 'yyyyMMdd')}` +
        `&details=${encodeURIComponent(details)}&location=${encodedLocation}`;
      window.open(url, '_blank');
    } else {
      const url =
        `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose` +
        `&rru=addevent&subject=${encodedTitle}&body=${encodeURIComponent(details)}` +
        `&location=${encodedLocation}&allday=true` +
        `&startdt=${formatDateFn(start, 'yyyy-MM-dd')}&enddt=${formatDateFn(endExclusive, 'yyyy-MM-dd')}`;
      window.open(url, '_blank');
    }
  };


  const metadata: { key: string; icon: typeof CalendarDays; content: React.ReactNode }[] = [];

  metadata.push({
    key: 'dates',
    icon: CalendarDays,
    content: (
      <time dateTime={event.date_debut}>
        {formatDate(event.date_debut)}
        {event.date_debut !== event.date_fin && (
          <>
            {' – '}
            <time dateTime={event.date_fin}>{formatDate(event.date_fin)}</time>
          </>
        )}
      </time>
    ),
  });

  if (event.ville) {
    metadata.push({
      key: 'ville',
      icon: MapPin,
      content: (
        <span>
          {event.ville}
          {event.country && event.country !== 'France' ? `, ${event.country}` : ', France'}
        </span>
      ),
    });
  }

  if (event.nom_lieu) {
    metadata.push({ key: 'lieu', icon: Building, content: <span>{event.nom_lieu}</span> });
  }

  // Lot 10 — le tarif quitte la metadata du Hero : il reste dans le slide
  // « Préparer votre venue » (EventInfoCarousel).

  // L'affluence est désormais portée par la frise statistiques (lot 3).

  return (
    <section
      className={cn(
        'relative mx-auto w-full max-w-[1280px] rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8',
        !event.visible && isAdmin && 'bg-muted opacity-50',
      )}
    >
      {!event.visible && isAdmin && (
        <Badge variant="destructive" className="absolute right-4 top-4 z-10" title="Événement invisible">
          <EyeOff className="h-4 w-4" />
        </Badge>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        {/* Colonne gauche : contenu */}
        <div className="order-1 min-w-0 flex-1">
          {/* 1. Badges discrets */}
          {(event.type_event || mainSector) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {event.type_event && (
                <span className="inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-foreground">
                  {getEventTypeLabel(event.type_event)}
                </span>
              )}
              {mainSector && (
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-violet-soft px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] text-primary">
                  {mainSector}
                </span>
              )}
            </div>
          )}

          {/* 2. H1 */}
          <h1 className="heading-display break-words text-2xl font-bold leading-tight text-foreground sm:text-3xl lg:text-[2.5rem]">
            {event.nom_event}
          </h1>

          {/* 3. Accroche */}
          {event.accroche && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {event.accroche}
            </p>
          )}

          {/* 4. Metadata */}
          <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {metadata.map(({ key, icon: Icon, content }) => (
              <li key={key} className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 flex-shrink-0 text-foreground" aria-hidden="true" />
                {content}
              </li>
            ))}
          </ul>

          {/* Image — mobile uniquement, entre metadata et CTA */}
          {event.url_image && !imageFailed && (
            <div className="relative mt-6 w-32 md:hidden">
              <img
                src={event.url_image}
                alt={`Affiche du salon ${event.nom_event}${event.ville ? ` à ${event.ville}` : ''}`}
                loading="lazy"
                width={128}
                height={128}
                onError={() => setImageFailed(true)}
                className="h-32 w-32 rounded-xl border border-border bg-background object-contain p-2"
              />
              {isEventPast && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-foreground/50">
                  <span className="rounded-md border border-background/60 bg-background/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-background">
                    Terminé
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {canPrepareVisit && (
              <Button
                size="lg"
                onClick={onPrepareVisit}
                className="min-h-[44px] w-full gap-2 transition-colors duration-200 sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                Préparer ma visite avec l'IA
              </Button>
            )}

            {isEventPast ? (
              <Button
                variant="outline"
                size="lg"
                disabled
                className="min-h-[44px] w-full cursor-not-allowed opacity-60 sm:w-auto"
              >
                Inscriptions fermées
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={toggleFavorite.isPending}
                    className="min-h-[44px] w-full gap-2 sm:w-auto"
                  >
                    <Calendar className="h-4 w-4" />
                    Ajouter à mon agenda
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-popover">
                  <DropdownMenuItem onSelect={() => void handleFavoriteClick()} className="gap-2 py-2.5">
                    {isFavorite ? (
                      <CalendarCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                    {isFavorite ? 'Retirer de l’agenda Lotexpo' : 'Agenda Lotexpo'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openCalendar('gcal')} className="gap-2 py-2.5">
                    <Calendar className="h-4 w-4" />
                    Google Calendar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openCalendar('outlook')} className="gap-2 py-2.5">
                    <Calendar className="h-4 w-4" />
                    Outlook
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {official && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.open(official, '_blank')}
                className="min-h-[44px] w-full gap-2 sm:w-auto"
              >
                <ExternalLink className="h-4 w-4" />
                Site officiel
              </Button>
            )}
          </div>

          {isEventPast && (
            <p className="mt-2 text-xs text-muted-foreground">Cet événement est terminé.</p>
          )}
        </div>

        {/* Colonne droite : image (desktop) */}
        {event.url_image && !imageFailed && (
          <div className="order-2 hidden flex-shrink-0 md:block">
            <div className="relative flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background p-3 lg:h-56 lg:w-56">
              <img
                src={event.url_image}
                srcSet={`${event.url_image} 1x, ${event.url_image} 2x`}
                sizes="(max-width: 1024px) 192px, 224px"
                alt={`Affiche du salon ${event.nom_event}${event.ville ? ` à ${event.ville}` : ''}${
                  event.date_debut ? ` ${new Date(event.date_debut).getFullYear()}` : ''
                }`}
                loading="lazy"
                width={224}
                height={224}
                onError={() => setImageFailed(true)}
                className="max-h-full max-w-full object-contain"
              />
              {isEventPast && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-foreground/50">
                  <span className="rounded-md border-[1.5px] border-background/60 bg-background/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-background">
                    Événement passé
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {event.url_image && imageFailed && (
          <div className="order-2 hidden flex-shrink-0 md:block">
            <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-border bg-muted lg:h-56 lg:w-56">
              <ImageOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>

      <AuthRequiredModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </section>
  );
};
