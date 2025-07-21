
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Building } from 'lucide-react';
import { SimilarEvents } from './SimilarEvents';
import type { Event } from '@/types/event';
import { formatAddress } from '@/utils/formatAddress';

interface EventSidebarProps {
  event: Event;
}

export const EventSidebar = ({ event }: EventSidebarProps) => {
  // Format address differently based on whether it's a pending event or not
  const getEventAddress = (event: Event): string => {
    // Pour les événements en attente (events_import), utiliser les champs rue, code_postal, ville
    if (event.slug?.startsWith('pending-') || !event.visible) {
      return formatAddress(event.rue, event.code_postal, event.ville);
    }
    
    // Pour les événements publiés (events), utiliser la logique existante
    return formatAddress(event.rue, event.code_postal, event.ville);
  };

  return (
    <aside className="space-y-6">
      {/* Informations pratiques */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">
            <h2 className="flex items-center text-left">
              <MapPin className="h-5 w-5 mr-2 text-accent" />
              Informations pratiques
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lieu & Adresse */}
          <dl className="space-y-4 text-left">
            {event.nom_lieu && (
              <div className="flex items-start gap-2">
                <Building className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <dt className="font-semibold text-gray-900">Nom du lieu</dt>
                  <dd className="text-gray-600">{event.nom_lieu}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <dt className="font-semibold text-gray-900">Adresse</dt>
                <dd className="text-gray-600">{getEventAddress(event)}</dd>
              </div>
            </div>
          </dl>

          {/* Carte */}
          <div className="text-left">
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
        sector={event.secteur} 
        city={event.ville} 
      />
    </aside>
  );
};
