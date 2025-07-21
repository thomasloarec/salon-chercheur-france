
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Building } from 'lucide-react';
import { SimilarEvents } from './SimilarEvents';
import type { Event } from '@/types/event';

interface EventSidebarProps {
  event: Event;
}

export const EventSidebar = ({ event }: EventSidebarProps) => {
  // Format address for pending events (events_import) vs published events (events)
  const getEventAddress = (event: Event): string => {
    console.log('getEventAddress called with event:', {
      slug: event.slug,
      visible: event.visible,
      rue: event.rue,
      code_postal: event.code_postal,
      ville: event.ville
    });

    // Construire l'adresse avec fallback intelligent
    const addressParts = [];
    
    // Rue
    if (event.rue && event.rue.trim() !== '') {
      addressParts.push(event.rue.trim());
    }
    
    // Code postal et ville
    if (event.code_postal && event.code_postal.trim() !== '') {
      if (event.ville && event.ville.trim() !== '') {
        addressParts.push(`${event.code_postal.trim()} ${event.ville.trim()}`);
      } else {
        addressParts.push(event.code_postal.trim());
      }
    } else if (event.ville && event.ville.trim() !== '') {
      addressParts.push(event.ville.trim());
    }
    
    const result = addressParts.length > 0 ? addressParts.join(', ') : 'Adresse non précisée';
    console.log('Final address result:', result);
    return result;
  };

  // Debug temporaire - calculer l'adresse
  const addressResult = getEventAddress(event);
  console.log('🔍 DEBUG - Address result:', addressResult);
  console.log('🔍 DEBUG - Complete event object:', JSON.stringify(event, null, 2));

  return (
    <aside className="space-y-6">
      {/* DEBUG temporaire - À supprimer après résolution */}
      <div style={{ color: 'red', border: '2px solid red', padding: '10px', marginBottom: '20px' }}>
        <strong>🧪 DEBUG - Données complètes:</strong>
        <br />
        <strong>Adresse calculée:</strong> "{addressResult}"
        <br />
        <strong>Rue:</strong> "{event.rue || 'N/A'}"
        <br />
        <strong>Code postal:</strong> "{event.code_postal || 'N/A'}"
        <br />
        <strong>Ville:</strong> "{event.ville || 'N/A'}"
        <br />
        <strong>Visible:</strong> {event.visible ? 'true' : 'false'}
        <br />
        <strong>Slug:</strong> "{event.slug || 'N/A'}"
        <br />
        <strong>Event ID:</strong> "{event.id}"
      </div>

      {/* Informations pratiques */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">
            <div className="flex items-center text-left">
              <MapPin className="h-5 w-5 mr-2 text-accent" />
              Informations pratiques
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lieu & Adresse */}
          <div className="space-y-4 text-left">
            {event.nom_lieu && (
              <div className="flex items-start gap-2">
                <Building className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Nom du lieu</div>
                  <div className="text-gray-600">{event.nom_lieu}</div>
                </div>
              </div>
            )}
            
            {/* ADRESSE - avec debug visible */}
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Adresse</div>
                <div className="text-gray-600">
                  {addressResult}
                  {/* Debug inline temporaire */}
                  <div style={{ fontSize: '10px', color: 'blue', marginTop: '5px' }}>
                    DEBUG RAW: rue="{event.rue}", cp="{event.code_postal}", ville="{event.ville}"
                  </div>
                </div>
              </div>
            </div>
          </div>

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
