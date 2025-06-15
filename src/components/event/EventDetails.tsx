
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Building, Users, Clock } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventDetailsProps {
  event: Event;
}

export const EventDetails = ({ event }: EventDetailsProps) => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-accent" />
          Informations pratiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Lieu</h4>
          <div className="space-y-1 text-gray-600">
            {event.venue_name && (
              <div className="flex items-center">
                <Building className="h-4 w-4 text-accent mr-2" />
                <span className="font-medium">{event.venue_name}</span>
              </div>
            )}
            {event.address && (
              <p className="pl-6">{event.address}</p>
            )}
            <p className="pl-6">{event.city}, {event.country || 'France'}</p>
          </div>
        </div>

        {event.estimated_visitors && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Affluence</h4>
            <div className="flex items-center text-gray-600">
              <Users className="h-4 w-4 text-accent mr-2" />
              <span>{event.estimated_visitors.toLocaleString('fr-FR')} visiteurs attendus</span>
            </div>
          </div>
        )}

        {event.organizer_name && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Organisateur</h4>
            <p className="text-gray-600 pl-6">{event.organizer_name}</p>
          </div>
        )}

        {event.entry_fee && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Tarifs</h4>
            <p className="text-gray-600 pl-6">{event.entry_fee}</p>
          </div>
        )}

        {/* Placeholder pour carte désactivée */}
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-2">Localisation</h4>
          <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MapPin className="h-8 w-8 mx-auto mb-2" />
              <p>Carte temporairement indisponible</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
