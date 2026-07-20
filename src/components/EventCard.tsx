
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MapPin, EyeOff, Eye, Radio, Radar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Event } from '@/types/event';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useCrmEventMatches } from '@/hooks/useCrmEventMatches';

import { cn } from '@/lib/utils';
import FavoriteButton from './FavoriteButton';
import { EventSectors } from '@/components/ui/event-sectors';
import { EVENT_PLACEHOLDER } from '@/lib/images';

function isEventOngoing(event: Event): boolean {
  const today = new Date().toISOString().split('T')[0];
  const start = event.date_debut;
  const end = event.date_fin || event.date_debut;
  return !!(start && end && start <= today && today <= end);
}

function daysUntil(start: string): number | null {
  if (!start) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const ms = d.getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 86_400_000);
}

interface EventCardProps {
  event: Event;
  view?: 'grid';
  adminPreview?: boolean;
  onPublish?: (eventId: string) => void;
  exhibitorCount?: number;
  noveltyCount?: number;
}

// Utility function for date formatting
function formatDateRange(start: string, end: string) {
  const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  const sd = new Date(start).toLocaleDateString('fr-FR', opt);
  const ed = new Date(end).toLocaleDateString('fr-FR', opt);
  return start === end ? sd : `${sd} → ${ed}`;
}

const EventCard = ({ event, view = 'grid', adminPreview = false, onPublish, exhibitorCount, noveltyCount }: EventCardProps) => {
  const { isAdmin } = useIsAdmin();
  const ongoing = isEventOngoing(event);

  const hasExhibitors = !adminPreview && typeof exhibitorCount === 'number' && exhibitorCount > 0;
  const hasNovelties = !adminPreview && typeof noveltyCount === 'number' && noveltyCount > 0;

  // Badge "Radar CRM" : nb d'entreprises du CRM de l'utilisateur connecté
  // qui exposent à cet event. Invisible si anon / sans CRM / 0 match.
  const { data: crmMatches } = useCrmEventMatches();
  const crmCount = !adminPreview ? crmMatches?.get(event.id) : undefined;
  const hasCrmMatches = typeof crmCount === 'number' && crmCount > 0;

  // Use database-generated slug (tous les événements en ont un maintenant)
  const eventSlug = event.slug;

  const targetHref = adminPreview ? `/admin/events/${event.id}` : `/events/${eventSlug}`;
  const days = ongoing ? null : daysUntil(event.date_debut);
  const accroche = (event as unknown as { accroche?: string }).accroche ?? event.description_event ?? '';
  const hasAccroche = typeof accroche === 'string' && accroche.trim().length > 0;

  return (
    <article
      className={cn(
        'group relative border-b border-border/60 transition-colors duration-200 ease-out',
        'hover:bg-muted/40 motion-reduce:transition-none',
        !event.visible && isAdmin && 'opacity-60',
      )}
    >
      <Link
        to={targetHref}
        aria-label={event.nom_event}
        className="absolute inset-0 z-[1] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />

      {/* Contenu non interactif : laisse passer les clics vers le <Link> étiré ci-dessus.
          Les éléments réellement interactifs (FavoriteButton, bouton Publier) réactivent
          pointer-events + z-index au-dessus du lien. */}
      <div className="pointer-events-none relative z-[2] grid gap-4 p-4 grid-cols-1 min-[560px]:grid-cols-[140px_1fr] min-[1040px]:grid-cols-[172px_1fr_auto] min-[1040px]:gap-6 min-[1040px]:items-center">
        {/* Vignette */}
        <div className="relative w-full overflow-hidden rounded-xl bg-muted aspect-[16/10] min-[560px]:w-[140px] min-[1040px]:w-[172px]">
          {adminPreview && (
            <div className="absolute inset-0 z-[1] bg-foreground/20 transition-opacity group-hover:bg-foreground/10" />
          )}
          <img
            src={(event.url_image ?? '').trim() || EVENT_PLACEHOLDER}
            alt={`Visuel — ${event.nom_event || 'Événement'}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = EVENT_PLACEHOLDER;
            }}
          />

          {/* Overlays admin */}
          {adminPreview && (
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 z-[3] bg-info/10 text-foreground border-info/30"
              title="Événement en attente de publication"
            >
              En attente
            </Badge>
          )}
          {!event.visible && isAdmin && !adminPreview && (
            <Badge
              variant="destructive"
              className="absolute top-2 left-2 z-[3]"
              title="Événement invisible"
            >
              <EyeOff className="h-4 w-4" />
            </Badge>
          )}

          {!adminPreview && !ongoing && (
            <div className="pointer-events-auto absolute top-2 right-2 z-[3]">
              <FavoriteButton eventId={event.id} size="sm" variant="inline" />
            </div>
          )}
        </div>

        {/* Corps */}
        <div className="min-w-0 flex flex-col gap-2">
          <h3
            className="heading-display text-[1.2rem] leading-tight text-foreground group-hover:text-primary transition-colors"
            title={event.nom_event}
          >
            {event.nom_event}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            <EventSectors event={event} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" />
              {formatDateRange(event.date_debut, event.date_fin)}
            </span>
            {event.ville && (
              <>
                <span aria-hidden="true" className="text-border">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {event.ville}
                </span>
              </>
            )}
            {ongoing ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-semibold"
                title="Événement en cours"
              >
                <Radio className="h-3 w-3 animate-pulse motion-reduce:animate-none" />
                En cours
              </span>
            ) : days !== null && days >= 0 ? (
              <span className="inline-flex items-center rounded-full bg-muted text-foreground px-2 py-0.5 text-xs font-medium">
                {days === 0 ? "Aujourd'hui" : `J-${days}`}
              </span>
            ) : null}
          </div>

          {hasAccroche && (
            <p className="text-sm text-muted-foreground line-clamp-1 min-[560px]:line-clamp-2 min-[1040px]:line-clamp-1">
              {accroche}
            </p>
          )}
        </div>

        {/* Rail métriques */}
        {(hasExhibitors || hasNovelties || hasCrmMatches || !adminPreview) && (
          <div className="col-span-full min-[1040px]:col-span-1 flex flex-col gap-3 border-t border-border/60 pt-3 min-[1040px]:border-t-0 min-[1040px]:border-l min-[1040px]:pt-0 min-[1040px]:pl-6 min-[1040px]:w-[220px]">
            {(hasExhibitors || hasNovelties || hasCrmMatches) && (
              <div className="flex items-center gap-4 min-[1040px]:justify-end">
                {hasExhibitors && (
                  <div className="flex flex-col leading-none">
                    <span className="heading-display text-2xl text-foreground tabular-nums">{exhibitorCount}</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">
                      {exhibitorCount! > 1 ? 'exposants' : 'exposant'}
                    </span>
                  </div>
                )}
                {hasExhibitors && hasNovelties && (
                  <span aria-hidden="true" className="h-8 w-px bg-border" />
                )}
                {hasNovelties && (
                  <div className="flex flex-col leading-none">
                    <span className="heading-display text-2xl text-foreground tabular-nums">{noveltyCount}</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">
                      {noveltyCount! > 1 ? 'nouveautés' : 'nouveauté'}
                    </span>
                  </div>
                )}
                {hasCrmMatches && (
                  <span
                    role="img"
                    aria-label={`${crmCount} entreprise${crmCount! > 1 ? 's' : ''} de votre CRM expose${crmCount! > 1 ? 'nt' : ''} ici`}
                    title={`${crmCount} entreprise${crmCount! > 1 ? 's' : ''} de votre CRM`}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 text-xs font-semibold"
                  >
                    <Radar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {crmCount}
                  </span>
                )}
              </div>
            )}
            {!adminPreview && (
              <div className="min-[1040px]:self-end">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                  Voir le salon
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bouton Publier flottant pour adminPreview */}
      {adminPreview && onPublish && (
        <Button
          size="sm"
          variant="secondary"
          className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-[3] bg-card text-foreground hover:bg-muted shadow-lg"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPublish(event.id);
          }}
        >
          <Eye className="h-4 w-4 mr-2" />
          Publier
        </Button>
      )}
    </article>
  );
};

export default EventCard;
