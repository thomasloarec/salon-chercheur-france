import { useMemo, useCallback, useRef, useEffect } from 'react';
import EventCard from './EventCard';
import { Calendar, Loader2 } from 'lucide-react';
import type { Event } from '@/types/event';
import { groupEventsByMonth } from '@/utils/eventGrouping';

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

  // Group events by month
  const groupedEvents = useMemo(() => {
    if (!events || events.length === 0) return [];
    
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
    );
    
    return groupEventsByMonth(sortedEvents);
  }, [events]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
    <div className="space-y-10">
      {groupedEvents.map(({ monthLabel, events: monthEvents }) => (
        <section key={monthLabel} className="border-t border-gray-200 pt-8 first:border-t-0 first:pt-0">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 capitalize">
            {monthLabel}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {monthEvents.map((event) => (
              <EventCard key={event.id} event={event} view="grid" />
            ))}
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
