import { useEffect, useMemo, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventSeries } from '@/hooks/useEventSeries';
import EventCompactCard from './EventCompactCard';
import type { Event } from '@/types/event';

interface EventSeriesBlockProps {
  event: Pick<Event, 'id' | 'nom_event'>;
  onSeriesIds?: (ids: string[]) => void;
}

/**
 * Autres éditions du même salon (lot 9) — rangée pleine largeur, compacte.
 * Masqué en dessous de 2 résultats, 4 éditions maximum.
 * Les ids affichés sont remontés via onSeriesIds pour alimenter
 * l'exclusion des « événements similaires ».
 */
export const EventSeriesBlock = ({ event, onSeriesIds }: EventSeriesBlockProps) => {
  const { data: seriesEvents, isLoading } = useEventSeries(event);

  const displayEvents = useMemo(() => seriesEvents?.slice(0, 4), [seriesEvents]);

  // Stabilise les ids pour éviter les boucles de rendu.
  const prevIdsRef = useRef<string>('');
  useEffect(() => {
    if (!onSeriesIds || isLoading) return;
    const ids = displayEvents?.map((e) => e.id) ?? [];
    const key = ids.join(',');
    if (key !== prevIdsRef.current) {
      prevIdsRef.current = key;
      onSeriesIds(ids);
    }
  }, [displayEvents, isLoading, onSeriesIds]);

  if (!isLoading && (!displayEvents || displayEvents.length < 2)) {
    return null;
  }

  return (
    <section className="min-w-0">
      <h2 className="heading-display text-xl font-semibold text-foreground sm:text-2xl">
        Autres éditions de ce salon
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-xl" />
            ))
          : displayEvents!.map((ev) => (
              <EventCompactCard
                key={ev.id}
                slug={ev.slug}
                name={ev.nom_event}
                dateDebut={ev.date_debut}
                ville={ev.ville}
                imageUrl={ev.url_image}
              />
            ))}
      </div>
    </section>
  );
};
