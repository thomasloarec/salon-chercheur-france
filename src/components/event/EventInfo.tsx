
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, Users, ExternalLink, Building } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';
import CalBtn from '../CalBtn';
import { formatAddress } from '@/utils/formatAddress';

interface EventInfoProps {
  event: Event;
}

export const EventInfo = ({ event }: EventInfoProps) => {
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  };

  const official = event.url_site_officiel;

  return (
    <Card className="text-left">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-left">
          <CalendarDays className="h-5 w-5 text-accent" />
          Informations pratiques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-left">
        <div className="text-left">
          <h4 className="font-medium text-gray-900 mb-1 text-left">Dates</h4>
          <p className="text-gray-600 text-left">
            Du {formatDate(event.date_debut)} au {formatDate(event.date_fin)}
          </p>
        </div>

        <div className="text-left">
          <h4 className="font-medium text-gray-900 mb-1 text-left">Lieu</h4>
          <dl className="space-y-2 text-left">
            {event.nom_lieu && (
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <dt className="sr-only">Nom du lieu</dt>
                  <dd className="font-medium text-left">{event.nom_lieu}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <dt className="sr-only">Adresse</dt>
                <dd className="text-gray-600 text-left">{formatAddress(event.rue, event.code_postal, event.ville)}</dd>
              </div>
            </div>
          </dl>
        </div>

        {event.affluence && (
          <div className="text-left">
            <h4 className="font-medium text-gray-900 mb-1 text-left">Visiteurs attendus</h4>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <span className="text-gray-600 text-left">
                {event.affluence.toLocaleString('fr-FR')} visiteurs
              </span>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-2 text-left">Ajouter au calendrier</h4>
          <div className="flex flex-wrap items-center gap-2">
            <CalBtn type="gcal" event={event} />
            <CalBtn type="outlook" event={event} />
            {official && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(official, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Site officiel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
