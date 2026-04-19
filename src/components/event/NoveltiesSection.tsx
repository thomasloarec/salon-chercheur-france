import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Rocket } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import NoveltyEventCard from '@/components/novelty/NoveltyEventCard';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import { NoveltiesPreLaunchBanner } from './NoveltiesPreLaunchBanner';
import { NoveltyNotificationDialog } from './NoveltyNotificationDialog';
import { useInfiniteNovelties } from '@/hooks/useInfiniteNovelties';
import type { Event } from '@/types/event';
import { Button } from '@/components/ui/button';

type SortBy = 'awaited' | 'recent';

const INITIAL_VISIBLE = 4;

interface NoveltiesSectionProps {
  event: Event;
}

export default function NoveltiesSection({ event }: NoveltiesSectionProps) {
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('awaited');
  const [showAll, setShowAll] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const targetNoveltyId = searchParams.get('novelty');
  const handledTargetRef = useRef<string | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteNovelties({
    event_id: event.id,
    sort: sortBy,
    pageSize: 10,
    enabled: !!event.id,
  });

  // Intersection Observer pour le scroll infini (uniquement quand "Tout afficher")
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (
        target.isIntersecting &&
        hasNextPage &&
        !isFetchingNextPage &&
        showAll
      ) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, showAll],
  );

  useEffect(() => {
    const option = { root: null, rootMargin: '100px', threshold: 0.1 };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    return () => observer.disconnect();
  }, [handleObserver]);

  const daysUntilEvent = differenceInDays(
    new Date(event.date_debut),
    new Date(),
  );
  const isPreLaunch = daysUntilEvent > 60;

  const allNovelties = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // Deep-link : si ?novelty=<id> est présent, charger les pages suivantes
  // jusqu'à trouver la card, scroll + highlight, puis nettoyer l'URL.
  useEffect(() => {
    if (!targetNoveltyId || isLoading) return;
    if (handledTargetRef.current === targetNoveltyId) return;

    const found = allNovelties.some((n) => n.id === targetNoveltyId);

    if (!found) {
      if (hasNextPage && !isFetchingNextPage) {
        // Forcer l'expansion pour rendre la nouveauté ciblée visible
        setShowAll(true);
        fetchNextPage();
      } else if (!hasNextPage) {
        handledTargetRef.current = targetNoveltyId;
      }
      return;
    }

    // S'assurer que la card est rendue (sortir du repli si nécessaire)
    setShowAll(true);
    handledTargetRef.current = targetNoveltyId;

    const rafId = requestAnimationFrame(() => {
      const el = document.getElementById(`novelty-${targetNoveltyId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('novelty-deeplink-highlight');
      window.setTimeout(() => {
        el.classList.remove('novelty-deeplink-highlight');
        const next = new URLSearchParams(searchParams);
        next.delete('novelty');
        setSearchParams(next, { replace: true });
      }, 3000);
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    targetNoveltyId,
    isLoading,
    allNovelties,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    searchParams,
    setSearchParams,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-40 bg-muted animate-pulse rounded" />
          <div className="h-9 w-28 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-32 bg-muted animate-pulse rounded-2xl" />
          <div className="h-32 bg-muted animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  // ÉTAT A — Aucune nouveauté
  if (!error && total === 0) {
    if (isPreLaunch) {
      return (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Nouveautés</h2>
            </div>

            <NoveltiesPreLaunchBanner
              eventDate={event.date_debut}
              eventName={event.nom_event}
              onNotifyMe={() => setNotificationDialogOpen(true)}
            />
          </div>

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

    // Cas normal : pas de nouveautés, message sobre + CTA exposant discret
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold">Nouveautés</h2>
        </div>
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                Aucune nouveauté publiée pour l'instant.
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Vous exposez ? Soyez le premier à annoncer votre présence.
              </p>
            </div>
            <AddNoveltyButton
              event={event}
              variant="outline"
              size="sm"
              label="Exposant : publier une nouveauté"
              className="shrink-0"
            />
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Nouveautés</h2>
        <div className="rounded-2xl border p-6 text-center">
          <p className="text-destructive mb-3 text-sm">
            Erreur lors du chargement des nouveautés
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  // ÉTATS B & C — au moins une nouveauté
  const sectionTitle = total <= 3 ? 'Nouveautés à repérer' : 'Nouveautés';
  const visibleNovelties =
    showAll || total <= INITIAL_VISIBLE
      ? allNovelties
      : allNovelties.slice(0, INITIAL_VISIBLE);
  const hasMoreToShow =
    !showAll &&
    total > INITIAL_VISIBLE &&
    allNovelties.length > INITIAL_VISIBLE;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{sectionTitle}</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              ({total})
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Repérez les annonces des exposants pour préparer votre visite.
          </p>
        </div>
        <AddNoveltyButton
          event={event}
          label="Publier"
          size="sm"
          variant="outline"
          className="shrink-0"
        />
      </div>

      {/* Tri — uniquement si 4+ nouveautés */}
      {total > 3 && (
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'awaited' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('awaited')}
            aria-pressed={sortBy === 'awaited'}
          >
            Les plus attendues
          </Button>
          <Button
            variant={sortBy === 'recent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('recent')}
            aria-pressed={sortBy === 'recent'}
          >
            Récentes
          </Button>
        </div>
      )}

      {/* Liste compacte */}
      <div className="space-y-3">
        {visibleNovelties.map((novelty) => (
          <NoveltyEventCard
            key={novelty.id}
            novelty={novelty}
            eventSlug={event.slug}
            eventDateDebut={event.date_debut}
          />
        ))}
      </div>

      {/* Révélation progressive : afficher le reste */}
      {hasMoreToShow && (
        <div className="flex justify-center pt-1">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            Afficher les {total - INITIAL_VISIBLE} autres nouveautés
          </Button>
        </div>
      )}

      {/* Loader scroll infini (actif seulement après "Tout afficher") */}
      <div ref={loaderRef} className="flex justify-center py-2">
        {isFetchingNextPage && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </section>
  );
}
