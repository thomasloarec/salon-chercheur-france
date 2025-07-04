import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Building, Users, Clock } from 'lucide-react';
import type { Event } from '@/types/event';
import { formatAddress } from '@/utils/formatAddress';

interface EventDetailsProps {
  event: Event;
}

export const EventDetails = ({ event }: EventDetailsProps) => {
  // Debug log pour vérifier les props d'adresse
  console.debug('Addr props', {
    address: event.address,
    postal_code: event.postal_code,
    city: event.city
  });

  return (
    <Card className="mb-6 text-left">
      <CardHeader>
        <CardTitle className="flex items-center text-left">
          <MapPin className="h-5 w-5 mr-2 text-accent" />
          Informations pratiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-left">
        <div className="text-left">
          <h4 className="font-medium text-gray-900 mb-2 text-left">Lieu</h4>
          <dl className="space-y-2 text-gray-600 text-left">
            {event.venue_name && (
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 text-accent flex-shrink-0 mt-1" />
                <div className="text-left">
                  <dt className="sr-only">Nom du lieu</dt>
                  <dd className="font-medium text-left">{event.venue_name}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-accent flex-shrink-0 mt-1" />
              <div className="text-left">
                <dt className="sr-only">Adresse</dt>
                <dd className="text-left">{formatAddress(event.address, event.postal_code, event.city)}</dd>
              </div>
            </div>
          </dl>
        </div>

        {event.estimated_visitors && (
          <div className="text-left">
            <h4 className="font-medium text-gray-900 mb-2 text-left">Affluence</h4>
            <div className="flex items-center text-gray-600">
              <Users className="h-4 w-4 text-accent mr-2" />
              <span className="text-left">{event.estimated_visitors.toLocaleString('fr-FR')} visiteurs attendus</span>
            </div>
          </div>
        )}

        {event.organizer_name && (
          <div className="text-left">
            <h4 className="font-medium text-gray-900 mb-2 text-left">Organisateur</h4>
            <p className="text-gray-600 text-left ml-6">{event.organizer_name}</p>
          </div>
        )}

        {event.entry_fee && (
          <div className="text-left">
            <h4 className="font-medium text-gray-900 mb-2 text-left">Tarifs</h4>
            <p className="text-gray-600 text-left ml-6">{event.entry_fee}</p>
          </div>
        )}

        {/* Placeholder pour carte désactivée */}
        <div className="mt-6 text-left">
          <h4 className="font-medium text-gray-900 mb-2 text-left">Localisation</h4>
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
