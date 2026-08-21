import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import NoveltiesCarousel from './NoveltiesCarousel';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import NoveltyExampleEmptyState from '@/components/novelty/NoveltyExampleEmptyState';
import { NoveltiesPreLaunchBanner } from './NoveltiesPreLaunchBanner';
import { NoveltyNotificationDialog } from './NoveltyNotificationDialog';
import { useInfiniteNovelties } from '@/hooks/useInfiniteNovelties';
import { useNoveltyCommentCounts } from '@/hooks/useNoveltyComments';
import { getDaysUntilStart, NOVELTY_OPEN_DAYS_BEFORE } from '@/lib/eventCapabilities';
import type { Event } from '@/types/event';
import { Button } from '@/components/ui/button';

/**
 * Le carousel affiche l'intégralité des nouveautés d'un salon (maximum
 * constaté en base : 7). On charge donc une seule page suffisamment large
 * plutôt que de conserver la pagination + scroll infini de l'ancienne liste.
 */
const PAGE_SIZE = 30;

interface NoveltiesSectionProps {
  event: Event;
  exhibitorCount?: number;
  isEventPast?: boolean;
}

export default function NoveltiesSection({
  event,
  exhibitorCount,
  isEventPast = false,
}: NoveltiesSectionProps) {
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const targetNoveltyId = searchParams.get('novelty');
  const [deepLinkId, setDeepLinkId] = useState<string | null>(targetNoveltyId);
  const cleanedRef = useRef(false);

  const { data, isLoading, error, refetch, isFetching } = useInfiniteNovelties({
    // Lot 15 — ordre par défaut : la plus récemment publiée en premier.
    // (auparavant 'awaited' : likes desc, commentaires desc, created_at desc)
    event_id: event.id,
    sort: 'recent',
    pageSize: PAGE_SIZE,
    enabled: !!event.id,
  });

  const novelties = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const { data: commentCounts = {} } = useNoveltyCommentCounts(
    novelties.map((n) => n.id),
  );

  // Deep-link : on mémorise la cible puis on nettoie l'URL. La sélection dans
  // le carousel remplace le highlight de 3 secondes de l'ancienne liste.
  useEffect(() => {
    if (!targetNoveltyId || cleanedRef.current) return;
    setDeepLinkId(targetNoveltyId);
    cleanedRef.current = true;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.delete('novelty');
      setSearchParams(next, { replace: true });
      const el = document.getElementById('nouveautes');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [targetNoveltyId, searchParams, setSearchParams]);

  const daysUntilEvent = getDaysUntilStart(event.date_debut);
  const isPreLaunch =
    daysUntilEvent !== null && daysUntilEvent > NOVELTY_OPEN_DAYS_BEFORE;

  // ── Chargement : squelette aux dimensions du carousel (évite le CLS)
  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-72 max-w-[60%] animate-pulse rounded bg-muted" />
          <div className="h-9 w-28 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-[420px] w-full animate-pulse rounded-2xl bg-muted" />
      </section>
    );
  }

  // ── Erreur : réessai ciblé, sans recharger la page
  if (error) {
    return (
      <section className="space-y-3">
        <h2 className="heading-display text-2xl">Nouveautés à découvrir sur le salon</h2>
        <div className="mx-auto max-w-2xl rounded-2xl border p-6 text-center">
          <p className="mb-3 text-sm text-destructive">
            Les nouveautés n'ont pas pu être chargées.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            Réessayer
          </Button>
        </div>
      </section>
    );
  }

  // ── Zéro nouveauté
  if (total === 0) {
    // Événement terminé : aucune incitation à publier, section absente.
    if (isEventPast) return null;

    if (isPreLaunch) {
      return (
        <>
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="heading-display text-2xl">Nouveautés à découvrir sur le salon</h2>
              <AddNoveltyButton
                event={event}
                label="Vous exposez ? Publiez la vôtre"
                shortLabel="Vous exposez ?"
                size="sm"
                variant="outline"
              />

            </div>

            <NoveltiesPreLaunchBanner
              eventDate={event.date_debut}
              eventName={event.nom_event}
              exhibitorCount={exhibitorCount}
              onNotifyMe={() => setNotificationDialogOpen(true)}
            />
          </section>

          <NoveltyNotificationDialog
            open={notificationDialogOpen}
            onOpenChange={setNotificationDialogOpen}
            eventId={event.id}
            eventName={event.nom_event}
            eventDate={event.date_debut}
            eventSlug={event.slug}
          />
        </>
      );
    }

    // Période ouverte : carte exemple pédagogique + CTA exposant très visible.
    return (
      <NoveltyExampleEmptyState event={event} exhibitorCount={exhibitorCount} />
    );
  }

  // ── Au moins une nouveauté
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="heading-display text-2xl sm:text-[28px]">
            Nouveautés à découvrir sur le salon
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 1
              ? '1 nouveauté publiée par les exposants.'
              : `${total} nouveautés publiées par les exposants.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <AddNoveltyButton
            event={event}
            label="Vous exposez ? Publiez la vôtre"
            shortLabel="Vous exposez ?"
            size="sm"
            variant="outline"
          />
        </div>

      </div>

      <NoveltiesCarousel
        novelties={novelties}
        event={event}
        commentCounts={commentCounts}
        initialNoveltyId={deepLinkId}
      />
    </section>
  );
}
