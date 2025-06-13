
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, Users, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';
import CalBtn from '../CalBtn';

interface EventInfoProps {
  event: Event;
}

export const EventInfo = ({ event }: EventInfoProps) => {
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-accent" />
          Informations pratiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Dates</h4>
          <p className="text-gray-600">
            Du {formatDate(event.start_date)} au {formatDate(event.end_date)}
          </p>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-1">Lieu</h4>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
            <div>
              {event.venue_name && (
                <p className="font-medium">{event.venue_name}</p>
              )}
              {event.address && (
                <p className="text-gray-600">{event.address}</p>
              )}
              <p className="text-gray-600">{event.city}, {event.country || 'France'}</p>
            </div>
          </div>
        </div>

        {event.estimated_visitors && (
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Visiteurs attendus</h4>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <span className="text-gray-600">
                {event.estimated_visitors.toLocaleString('fr-FR')} visiteurs
              </span>
            </div>
          </div>
        )}

        {event.organizer_name && (
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Organisateur</h4>
            <p className="text-gray-600">{event.organizer_name}</p>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-2">Ajouter au calendrier</h4>
          <div className="flex gap-2">
            <CalBtn type="gcal" event={event} />
            <CalBtn type="outlook" event={event} />
          </div>
        </div>

        {event.event_url && (
          <div className="border-t pt-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => window.open(event.event_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Site officiel de l'événement
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
