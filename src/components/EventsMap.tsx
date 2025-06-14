
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect } from 'react';
import type { Event } from '@/types/event';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DEFAULT_CENTER: L.LatLngExpression = [46.6, 2.4]; // centre France
const DEFAULT_ZOOM = 5; // suffisant pour voir l'hexagone

// Mock coordinates for demonstration - these would come from geocoding in the future
const getCityCoordinates = (city: string): [number, number] => {
  const coordinates: Record<string, [number, number]> = {
    'Paris': [48.8566, 2.3522],
    'Lyon': [45.764, 4.8357],
    'Marseille': [43.2965, 5.3698],
    'Toulouse': [43.6047, 1.4442],
    'Nice': [43.7102, 7.2620],
    'Nantes': [47.2184, -1.5536],
    'Strasbourg': [48.5734, 7.7521],
    'Bordeaux': [44.8378, -0.5792],
    'Lille': [50.6292, 3.0573],
    'Rennes': [48.1173, -1.6778],
    'Villepinte': [48.9614, 2.5494],
  };
  
  return coordinates[city] || [46.5, 2.5]; // Default to center of France
};

// Hook interne pour ajuster la carte
function FitBounds({ events }: { events: Array<{ id: string; coordinates: [number, number] }> }) {
  const map = useMap();

  useEffect(() => {
    if (events.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(events.map((e) => e.coordinates));
    // Si un seul événement, zoom modéré (8) pour éviter un zoom trop rapproché
    if (events.length === 1) {
      map.setView(bounds.getCenter(), 8);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [events, map]);

  return null;
}

interface EventsMapProps {
  events: Event[];
}

export const EventsMap = ({ events }: EventsMapProps) => {
  const fallbackImage = '/placeholder.svg';
  
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  const eventsWithCoords = events.map(event => ({
    ...event,
    coordinates: getCityCoordinates(event.city)
  }));

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden border">
      <MapContainer 
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {eventsWithCoords.map(event => (
          <Marker key={event.id} position={event.coordinates}>
            <Popup>
              <div className="space-y-1 w-[200px]">
                <img 
                  src={event.image_url || fallbackImage} 
                  alt={event.name}
                  className="h-24 w-full object-cover rounded"
                />
                <strong className="block text-sm font-semibold">{event.name}</strong>
                <span className="text-xs text-gray-600">
                  {formatDate(event.start_date)}
                  {event.start_date !== event.end_date && 
                    ` - ${formatDate(event.end_date)}`
                  }
                </span>
                <p className="text-xs text-gray-600">{event.city}</p>
                <p className="text-xs text-blue-600">{event.sector}</p>
                {event.event_url && (
                  <a 
                    href={event.event_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs underline block mt-1"
                  >
                    Voir le salon →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Ajuste automatiquement la vue */}
        <FitBounds events={eventsWithCoords} />
      </MapContainer>
    </div>
  );
};
