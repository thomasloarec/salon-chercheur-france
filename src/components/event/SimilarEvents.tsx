
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';

interface SimilarEventsProps {
  currentEvent: Event;
  sector: string;
  city: string;
}

export const SimilarEvents = ({ currentEvent, sector, city }: SimilarEventsProps) => {
  const [similarEvents, setSimilarEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilarEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .neq('id', currentEvent.id)
          .or(`sector.eq.${sector},city.eq.${city}`)
          .gte('start_date', new Date().toISOString().split('T')[0])
          .order('start_date', { ascending: true })
          .limit(3);

        if (error) {
          console.error('Error fetching similar events:', error);
          return;
        }

        // Ensure event_type is properly typed
        const typedEvents = (data || []).map(event => ({
          ...event,
          event_type: event.event_type as Event['event_type']
        })) as Event[];

        setSimilarEvents(typedEvents);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarEvents();
  }, [currentEvent.id, sector, city]);

  if (loading) {
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

  if (similarEvents.length === 0) {
    return null;
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
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={`Image de ${event.name}`}
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
                      {event.name}
                    </h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center">
                        <CalendarDays className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span>{format(new Date(event.start_date), 'dd MMM yyyy', { locale: fr })}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span className="truncate">{event.city}</span>
                      </div>
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
