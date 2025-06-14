
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';

const DEFAULT_CENTER: [number, number] = [2.4, 46.6]; // France centre (lng, lat)
const DEFAULT_ZOOM = 5;

// Mock coordinates for demonstration - these would come from geocoding in the future
const getCityCoordinates = (city: string): [number, number] => {
  const coordinates: Record<string, [number, number]> = {
    'Paris': [2.3522, 48.8566],
    'Lyon': [4.8357, 45.764],
    'Marseille': [5.3698, 43.2965],
    'Toulouse': [1.4442, 43.6047],
    'Nice': [7.2620, 43.7102],
    'Nantes': [-1.5536, 47.2184],
    'Strasbourg': [7.7521, 48.5734],
    'Bordeaux': [-0.5792, 44.8378],
    'Lille': [3.0573, 50.6292],
    'Rennes': [-1.6778, 48.1173],
    'Villepinte': [2.5494, 48.9614],
  };
  
  return coordinates[city] || [2.5, 46.5]; // Default to center of France (lng, lat)
};

interface EventsMapProps {
  events: Event[];
}

export const EventsMap = ({ events }: EventsMapProps) => {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map only once
    if (!mapRef.current) {
      const apiKey = import.meta.env.VITE_MAPTILER_KEY;
      if (!apiKey) {
        console.error('VITE_MAPTILER_KEY is not defined. Please add your MapTiler API key to your environment variables.');
        return;
      }

      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });

      mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for events
    const eventsWithCoords = events.map(event => ({
      ...event,
      coordinates: getCityCoordinates(event.city)
    }));

    eventsWithCoords.forEach(event => {
      // Create popup content
      const popupContent = `
        <div class="space-y-1 w-[200px]">
          <img 
            src="${event.image_url || '/placeholder.svg'}" 
            alt="${event.name}"
            class="h-24 w-full object-cover rounded"
          />
          <strong class="block text-sm font-semibold">${event.name}</strong>
          <span class="text-xs text-gray-600">
            ${formatDate(event.start_date)}${event.start_date !== event.end_date ? ` - ${formatDate(event.end_date)}` : ''}
          </span>
          <p class="text-xs text-gray-600">${event.city}</p>
          <p class="text-xs text-blue-600">${event.sector}</p>
          ${event.event_url ? `<a href="${event.event_url}" target="_blank" rel="noopener noreferrer" class="text-primary text-xs underline block mt-1">Voir le salon →</a>` : ''}
        </div>
      `;

      const popup = new maplibregl.Popup({
        offset: 25
      }).setHTML(popupContent);

      const marker = new maplibregl.Marker({
        color: '#e8552b'
      })
        .setLngLat(event.coordinates)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit bounds if events are present
    if (eventsWithCoords.length > 0) {
      const coordinates = eventsWithCoords.map(e => e.coordinates);
      
      if (coordinates.length === 1) {
        // Single event - moderate zoom
        map.setCenter(coordinates[0]);
        map.setZoom(8);
      } else {
        // Multiple events - fit bounds
        const bounds = coordinates.reduce(
          (bounds, coord) => bounds.extend(coord),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
        );
        map.fitBounds(bounds, { 
          padding: 40, 
          duration: 600,
          maxZoom: 10
        });
      }
    } else {
      // No events - show France
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }

    return () => {
      // Cleanup markers on unmount
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    };
  }, [events]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden border">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
