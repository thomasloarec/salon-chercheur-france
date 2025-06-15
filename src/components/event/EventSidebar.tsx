
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Building, Users, User, Euro } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventSidebarProps {
  event: Event;
}

export const EventSidebar = ({ event }: EventSidebarProps) => {
  return (
    <aside className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl">
            <MapPin className="h-5 w-5 mr-2 text-accent" />
            Informations pratiques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lieu */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
              <Building className="h-4 w-4 text-accent mr-2" />
              Lieu
            </h4>
            <div className="space-y-1 text-gray-600 pl-6">
              {event.venue_name && (
                <p className="font-medium">{event.venue_name}</p>
              )}
              {event.address && (
                <p>{event.address}</p>
              )}
              <p>{event.city}, {event.region || event.country || 'France'}</p>
            </div>
          </div>

          {/* Affluence */}
          {event.estimated_visitors && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                <Users className="h-4 w-4 text-accent mr-2" />
                Affluence
              </h4>
              <p className="text-gray-600 pl-6">
                {event.estimated_visitors.toLocaleString('fr-FR')} visiteurs attendus
              </p>
            </div>
          )}

          {/* Organisateur */}
          {event.organizer_name && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                <User className="h-4 w-4 text-accent mr-2" />
                Organisateur
              </h4>
              <p className="text-gray-600 pl-6">{event.organizer_name}</p>
            </div>
          )}

          {/* Tarifs */}
          {event.entry_fee && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                <Euro className="h-4 w-4 text-accent mr-2" />
                Tarifs
              </h4>
              <p className="text-gray-600 pl-6">{event.entry_fee}</p>
            </div>
          )}

          {/* Carte */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
              <MapPin className="h-4 w-4 text-accent mr-2" />
              Localisation
            </h4>
            <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center border">
              <div className="text-center text-gray-500">
                <MapPin className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Carte temporairement indisponible</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
};
