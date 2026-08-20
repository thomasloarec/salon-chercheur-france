import { Skeleton } from '@/components/ui/skeleton';
import { useSameCityEvents } from '@/hooks/useSameCityEvents';
import EventCompactCard from './EventCompactCard';
import type { Event } from '@/types/event';

interface SameCityEventsBlockProps {
  event: Pick<Event, 'id' | 'ville'>;
}

/**
 * Salons à [ville] (lot 9) — rangée compacte pleine largeur.
 * Masqué en dessous de 2 résultats, 4 salons maximum, skeleton pendant le chargement.
 */
export const SameCityEventsBlock = ({ event }: SameCityEventsBlockProps) => {
  const { data: cityEvents, isLoading } = useSameCityEvents(event);

  if (!event.ville) return null;
  if (!isLoading && (!cityEvents || cityEvents.length < 2)) {
    return null;
  }

  return (
    <section className="min-w-0">
      <h2 className="heading-display text-xl font-semibold text-foreground sm:text-2xl">
        Salons à {event.ville}
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-xl" />
            ))
          : cityEvents!.map((ev) => (
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
