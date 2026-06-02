import { useMemo, useCallback, useRef, useEffect } from 'react';
import EventCard from './EventCard';
import { Calendar, Loader2 } from 'lucide-react';
import type { Event } from '@/types/event';
import { groupEventsByMonth } from '@/utils/eventGrouping';
import { useEventCardStats } from '@/hooks/useEventCardStats';

// Local YYYY-MM-DD (pas UTC) pour comparer les dates d'événement
function todayYmdLocal(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Un événement est "en cours" si date_debut <= aujourd'hui <= date_fin
function isOngoing(event: Event, today: string): boolean {
  const start = event.date_debut;
  const end = event.date_fin || event.date_debut;
  return !!(start && end && start <= today && today <= end);
}

interface EventsResultsInfiniteProps {
  events: Event[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  totalCount: number;
}

export const EventsResultsInfinite = ({ 
  events, 
  isLoading, 
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  totalCount
}: EventsResultsInfiniteProps) => {
  const observerRef = useRef<HTMLDivElement>(null);

  // Batched public stats (exposants + nouveautés) pour toutes les cartes affichées
  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);
  const { data: statsMap } = useEventCardStats(eventIds);

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const element = observerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px', // Load more when 200px from bottom
      threshold: 0.1
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Séparer les événements en cours des événements à venir
  const { ongoingEvents, groupedEvents } = useMemo(() => {
    if (!events || events.length === 0) {
      return { ongoingEvents: [] as Event[], groupedEvents: [] as ReturnType<typeof groupEventsByMonth> };
    }

    const today = todayYmdLocal();
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
    );

    const ongoing = sortedEvents.filter((e) => isOngoing(e, today));
    const upcoming = sortedEvents.filter((e) => !isOngoing(e, today));

    return { ongoingEvents: ongoing, groupedEvents: groupEventsByMonth(upcoming) };
  }, [events]);

  const renderCard = useCallback(
    (event: Event) => {
      const stat = statsMap?.[event.id];
      return (
        <EventCard
          key={event.id}
          event={event}
          view="grid"
          exhibitorCount={stat?.exhibitor_count}
          noveltyCount={stat?.novelty_count}
        />
      );
    },
    [statsMap]
  );

  if (isLoading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
            <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">
          Aucun salon trouvé
        </h3>
        <p className="text-gray-500">
          Essayez de modifier vos critères de recherche
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
      {ongoingEvents.length > 0 && (
        <section className="border-t border-gray-200 pt-8 first:border-t-0 first:pt-0">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-accent"></span>
            </span>
            Événements en cours
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
            {ongoingEvents.map((event) => renderCard(event))}
          </div>
        </section>
      )}

      {groupedEvents.map(({ monthLabel, events: monthEvents }) => (
        <section key={monthLabel} className="border-t border-gray-200 pt-8 first:border-t-0 first:pt-0">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 capitalize">
            {monthLabel}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5">
            {monthEvents.map((event) => renderCard(event))}
          </div>
        </section>
      ))}

      {/* Infinite scroll trigger */}
      <div ref={observerRef} className="flex justify-center py-8">
        {isFetchingNextPage ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Chargement de plus d'événements...</span>
          </div>
        ) : hasNextPage ? (
          <div className="text-muted-foreground text-sm">
            {events.length} sur {totalCount} événements affichés
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            Tous les événements sont affichés ({totalCount})
          </div>
        )}
      </div>
    </div>
  );
};
