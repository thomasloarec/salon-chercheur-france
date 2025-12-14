import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRelatedEvents } from "@/hooks/useRelatedEvents";
import type { Event } from "@/types/event";

interface RelatedEventsProps {
  event: Pick<Event, "id_event" | "secteur" | "ville">;
  limit?: number;
}

export const RelatedEvents = ({ event, limit = 4 }: RelatedEventsProps) => {
  const { data: relatedEvents, isLoading } = useRelatedEvents(event.id_event, limit);

  // Don't render if no related events
  if (!isLoading && (!relatedEvents || relatedEvents.length === 0)) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: fr });
  };

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <ArrowRight className="h-5 w-5 text-primary" />
        Événements similaires
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          // Skeleton loading
          Array.from({ length: limit }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-24 w-full rounded-md mb-3" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))
        ) : (
          relatedEvents?.map((relEvent) => (
            <Link
              key={relEvent.id}
              to={`/events/${relEvent.slug}`}
              className="group"
            >
              <Card className="p-4 h-full hover:shadow-md transition-shadow border-primary/10 hover:border-primary/30">
                {/* Image */}
                {relEvent.url_image && (
                  <div className="aspect-video rounded-md overflow-hidden mb-3 bg-muted">
                    <img
                      src={relEvent.url_image}
                      alt={relEvent.nom_event}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                {/* Title */}
                <h3 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
                  {relEvent.nom_event}
                </h3>

                {/* Metadata */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  {relEvent.date_debut && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(relEvent.date_debut)}</span>
                    </div>
                  )}
                  {relEvent.ville && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{relEvent.ville}</span>
                    </div>
                  )}
                </div>

                {/* Shared sectors badge */}
                {relEvent.shared_sectors_count && relEvent.shared_sectors_count > 0 && (
                  <div className="mt-2">
                    <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {relEvent.shared_sectors_count} secteur{relEvent.shared_sectors_count > 1 ? "s" : ""} en commun
                    </span>
                  </div>
                )}
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Link to all events */}
      {event.secteur && Array.isArray(event.secteur) && event.secteur.length > 0 && (
        <div className="mt-4 text-center">
          <Link
            to={`/events?sectors=${encodeURIComponent(event.secteur[0])}`}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Voir tous les événements {event.secteur[0]}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
};
