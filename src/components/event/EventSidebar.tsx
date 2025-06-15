
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Building } from 'lucide-react';
import { SimilarEvents } from './SimilarEvents';
import type { Event } from '@/types/event';

interface EventSidebarProps {
  event: Event;
}

export const EventSidebar = ({ event }: EventSidebarProps) => {
  return (
    <aside className="space-y-6">
      {/* Informations pratiques */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">
            <h2 className="flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-accent" />
              Informations pratiques
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lieu & Adresse */}
          <div>
            {event.venue_name && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center">
                  <Building className="h-4 w-4 text-accent mr-2" />
                  Nom du lieu
                </h3>
                <p className="text-gray-600 pl-6">{event.venue_name}</p>
              </div>
            )}
            {event.address && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center">
                  <MapPin className="h-4 w-4 text-accent mr-2" />
                  Adresse
                </h3>
                <p className="text-gray-600 pl-6">{event.address}</p>
              </div>
            )}
          </div>

          {/* Carte */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
              <MapPin className="h-4 w-4 text-accent mr-2" />
              Localisation
            </h3>
            <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center border">
              <div className="text-center text-gray-500">
                <MapPin className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Carte temporairement indisponible</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Événements similaires */}
      <SimilarEvents 
        currentEvent={event} 
        sector={event.sector} 
        city={event.city} 
      />
    </aside>
  );
};
