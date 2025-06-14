
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, MapPin, Calendar, Users, Euro } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventInfoProps {
  event: Event;
}

export const EventInfo = ({ event }: EventInfoProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-accent" />
          Informations pratiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Adresse</h4>
          <p className="text-gray-600">
            {event.venue_name && <span className="block">{event.venue_name}</span>}
            {event.address && <span className="block">{event.address}</span>}
            <span className="block">{event.city}, {event.region || 'France'}</span>
          </p>
        </div>

        {event.estimated_visitors && (
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-2 text-accent" />
            <span className="text-sm text-gray-600">
              {event.estimated_visitors.toLocaleString()} visiteurs attendus
            </span>
          </div>
        )}

        {event.entry_fee && (
          <div className="flex items-center">
            <Euro className="h-4 w-4 mr-2 text-accent" />
            <span className="text-sm text-gray-600">{event.entry_fee}</span>
          </div>
        )}

        {event.event_url && (
          <Button 
            className="w-full bg-accent hover:bg-accent/90"
            onClick={() => window.open(event.event_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Site officiel
          </Button>
        )}

        {/* Simple map placeholder */}
        <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Plan interactif à venir</p>
        </div>
      </CardContent>
    </Card>
  );
};
