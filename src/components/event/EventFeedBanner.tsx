import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Megaphone, ArrowUpRight, Settings2 } from 'lucide-react';
import ClaimSalonBanner from '@/components/event/ClaimSalonBanner';
import { INTERNAL_CTA, categoryLabel } from '@/lib/eventFeed';
import { useEventFeedPublic, type FeedUpdatePublic } from '@/hooks/useEventFeed';
import { trackFeedEvent, getLastSeen, markSeen } from '@/lib/eventFeedTracking';
import type { EventCapabilities } from '@/lib/eventCapabilities';
import type { Event } from '@/types/event';

interface Props {
  event: Event;
  capabilities: EventCapabilities;
}

interface ResolvedCta {
  label: string;
  href: string;
  external: boolean;
}

/**
 * Un CTA interne ne s'affiche que si la section visée existe réellement sur la
 * page. L'organisateur peut avoir dépublié son programme après avoir créé
 * l'annonce : mieux vaut aucun bouton qu'un bouton qui ne mène nulle part.
 */
function resolveCta(u: FeedUpdatePublic, caps: EventCapabilities): ResolvedCta | null {
  if (u.cta_type === 'none') return null;

  if (u.cta_type === 'external') {
    if (!u.cta_url || !u.cta_label) return null;
    return { label: u.cta_label, href: u.cta_url, external: true };
  }

  const available: Record<string, boolean> = {
    programme: caps.showProgramSection,
    exposants: caps.showExhibitorSection,
    nouveautes: caps.showNoveltiesSection,
  };
  if (!available[u.cta_type]) return null;

  const internal = INTERNAL_CTA[u.cta_type as keyof typeof INTERNAL_CTA];
  if (!internal) return null;
  return { label: internal.label, href: internal.anchor, external: false };
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

const CtaButton: React.FC<{ cta: ResolvedCta; onClick: () => void; size?: 'sm' | 'default' }> = ({
  cta, onClick, size = 'sm',
}) =>
  cta.external ? (
    <Button asChild size={size} variant="outline" className="shrink-0">
      {/* noopener noreferrer obligatoire : lien externe fourni par un tiers */}
      <a href={cta.href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {cta.label}
        <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
      </a>
    </Button>
  ) : (
    <Button asChild size={size} variant="outline" className="shrink-0">
      <a href={cta.href} onClick={onClick}>{cta.label}</a>
    </Button>
  );

const EventFeedBanner: React.FC<Props> = ({ event, capabilities }) => {
  const { user } = useAuth(); // null pour les sessions anonymes (cf. AuthContext)
  const ownerId = event.owner_user_id ?? null;
  const isOwner = !!user && ownerId === user.id;

  // Pas de propriétaire ou salon terminé : aucun Fil possible, on rend
  // strictement le comportement existant.
  const feedPossible = !!ownerId && !capabilities.isPast;

  const { data, isLoading } = useEventFeedPublic(feedPossible ? event.id : null);
  const items = useMemo(() => data ?? [], [data]);
  const top = items[0];
  const totalActive = top?.total_active ?? 0;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // Impression + pastille « Nouveau », une seule fois par annonce affichée.
  useEffect(() => {
    if (!top) return;
    trackFeedEvent(top.update_id, 'impression');
    const lastSeen = getLastSeen(event.id);
    setIsNew(!lastSeen || new Date(top.published_at) > new Date(lastSeen));
    markSeen(event.id, top.published_at);
  }, [top?.update_id, top?.published_at, event.id]);

  if (!feedPossible) return <ClaimSalonBanner event={event} />;

  // Pendant le chargement on ne rend rien : afficher puis remplacer
  // provoquerait un décalage visuel sur une bande de 48 px.
  if (isLoading) return null;

  // Salon revendiqué sans annonce active : on laisse la zone vide pour un
  // visiteur, et l'indicateur habituel pour l'organisateur.
  if (!top) return <ClaimSalonBanner event={event} />;

  const cta = resolveCta(top, capabilities);

  const openSheet = () => {
    trackFeedEvent(top.update_id, 'feed_open');
    setSheetOpen(true);
  };

  return (
    <>
      <div className="mx-auto w-full max-w-[1280px] rounded-xl border border-border bg-muted/40 px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground shrink-0">
          <Megaphone className="h-3.5 w-3.5" />
          Le fil du salon
        </span>

        {isNew && (
          <Badge variant="default" className="shrink-0 text-[10px] px-1.5 py-0">
            Nouveau
          </Badge>
        )}

        <span className="min-w-0 flex-1 text-foreground break-words">{top.message}</span>

        {cta && <CtaButton cta={cta} onClick={() => trackFeedEvent(top.update_id, 'cta_click')} />}

        {totalActive > 1 && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={openSheet}>
            Voir les {totalActive} annonces
          </Button>
        )}

        {isOwner && (
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link to={`/events/${event.slug || event.id}/gerer`}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Gérer
            </Link>
          </Button>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Le fil du salon</SheetTitle>
            <SheetDescription>
              Les annonces publiées par l'organisateur de {event.nom_event}.
            </SheetDescription>
          </SheetHeader>

          <ul className="mt-6 space-y-5">
            {items.map((u) => {
              const itemCta = resolveCta(u, capabilities);
              return (
                <li key={u.update_id} className="space-y-2 border-b border-border pb-5 last:border-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[11px]">
                      {categoryLabel(u.category)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDay(u.published_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground break-words">{u.message}</p>
                  {itemCta && (
                    <CtaButton
                      cta={itemCta}
                      onClick={() => trackFeedEvent(u.update_id, 'cta_click')}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default EventFeedBanner;
