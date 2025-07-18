
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
          .or(`secteur.eq.${sector},ville.eq.${city}`)
          .gte('date_debut', new Date().toISOString().split('T')[0])
          .order('date_debut', { ascending: true })
          .limit(3);

        if (error) {
          console.error('Error fetching similar events:', error);
          return;
        }

        // Transform data to match our Event interface
        // Using actual database column names
        const transformedEvents: Event[] = (data || []).map(event => ({
          id: event.id,
          nom_event: event.nom_event || '',
          description_event: event.description_event,
          date_debut: event.date_debut,
          date_fin: event.date_fin,
          secteur: event.secteur || '',
          nom_lieu: event.nom_lieu,
          ville: event.ville,
          region: event.region,
          country: event.pays,
          url_image: event.url_image,
          url_site_officiel: event.url_site_officiel,
          tags: event.tags,
          tarif: event.tarif,
          affluence: event.affluence,
          estimated_exhibitors: event.estimated_exhibitors,
          is_b2b: event.is_b2b,
          type_event: event.type_event as Event['type_event'],
          created_at: event.created_at,
          updated_at: event.updated_at,
          last_scraped_at: event.last_scraped_at,
          scraped_from: event.scraped_from,
          rue: event.rue,
          code_postal: event.code_postal,
          visible: event.visible,
          slug: event.slug,
          sectors: []
        }));

        setSimilarEvents(transformedEvents);
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
