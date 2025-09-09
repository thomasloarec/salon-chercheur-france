import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useRelatedEvents } from '@/hooks/useRelatedEvents';
import { Skeleton } from '@/components/ui/skeleton';

interface SimilarEventsProps {
  eventId: string;
}

export const SimilarEvents = ({ eventId }: SimilarEventsProps) => {
  console.debug('[SimilarEvents] eventId=', eventId);
  const { data: similarEvents, isLoading, error } = useRelatedEvents(eventId, 3);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Événements similaires</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Événements similaires</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Impossible de charger les événements similaires.</p>
        </CardContent>
      </Card>
    );
  }

  if (!similarEvents || similarEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Événements similaires</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aucun événement similaire à venir.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Événements similaires</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {similarEvents.map((event) => (
            <div key={event.id} className="border-b border-gray-100 pb-4 last:border-b-0">
              <Link 
                to={`/events/${event.slug}`}
                className="block hover:bg-gray-50 rounded p-2 -m-2 transition-colors cursor-pointer"
              >
                {/* Container flex avec image à gauche et détails à droite */}
                <div className="flex gap-4 items-start">
                  {/* Colonne de gauche : miniature/carte */}
                  <div className="flex-shrink-0">
                    {event.url_image ? (
                      <img
                        src={event.url_image}
                        alt={`Image de ${event.nom_event}`}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                        <CalendarDays className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Colonne de droite : détails textuels */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 mb-2 line-clamp-2 text-left hover:text-accent transition-colors">
                      {event.nom_event}
                    </h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center">
                        <CalendarDays className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span>{format(new Date(event.date_debut), 'dd MMM yyyy', { locale: fr })}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span className="truncate">{event.ville}</span>
                      </div>
                      {event.shared_sectors_count > 0 && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {event.shared_sectors_count} secteur{event.shared_sectors_count > 1 ? 's' : ''} en commun
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
        
        <Button variant="outline" className="w-full mt-4" asChild>
          <Link to="/events">
            Voir tous les événements
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};
