import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRelatedEvents } from '@/hooks/useRelatedEvents';
import { getSectorUrl } from '@/lib/sectorUrl';
import EventCompactCard from './EventCompactCard';
import type { Event } from '@/types/event';

interface RelatedEventsProps {
  event: Pick<Event, 'id_event' | 'secteur' | 'ville'>;
  limit?: number;
  excludeIds?: string[];
}

/**
 * « Vous pourriez également être intéressé par » (lot 9).
 * Rangée pleine largeur, seule sur sa ligne. Carousel horizontal sur petit écran.
 * Les éditions déjà affichées (bloc séries) sont exclues via excludeIds.
 */
export const RelatedEvents = ({ event, limit = 4, excludeIds = [] }: RelatedEventsProps) => {
  const { data: rawRelatedEvents, isLoading } = useRelatedEvents(
    event.id_event,
    limit + excludeIds.length,
  );

  const relatedEvents =
    rawRelatedEvents?.filter((e) => !excludeIds.includes(e.id)).slice(0, limit) ?? null;

  if (!isLoading && (!relatedEvents || relatedEvents.length === 0)) {
    return null;
  }

  const sectorLabel =
    event.secteur && Array.isArray(event.secteur) && event.secteur.length > 0
      ? (event.secteur[0] as string)
      : null;

  return (
    <section className="min-w-0">
      <h2 className="heading-display text-xl font-semibold text-foreground sm:text-2xl">
        Vous pourriez également être intéressé par
      </h2>

      <div className="mt-4 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: limit }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-[78%] flex-none rounded-xl sm:w-auto" />
            ))
          : relatedEvents?.map((relEvent) => (
              <EventCompactCard
                key={relEvent.id}
                variant="tile"
                slug={relEvent.slug}
                name={relEvent.nom_event}
                dateDebut={relEvent.date_debut}
                ville={relEvent.ville}
                imageUrl={relEvent.url_image}
                badge={
                  relEvent.shared_sectors_count && relEvent.shared_sectors_count > 0
                    ? `${relEvent.shared_sectors_count} secteur${
                        relEvent.shared_sectors_count > 1 ? 's' : ''
                      } en commun`
                    : null
                }
                className="w-[78%] flex-none snap-start sm:w-auto"
              />
            ))}
      </div>

      {sectorLabel && (
        <div className="mt-4">
          <Link
            to={getSectorUrl(sectorLabel)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Voir tous les événements {sectorLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
};
