
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import dayjs from 'dayjs';
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

interface EventWithCoords extends Event {
  coordinates: [number, number];
}

interface EventGroup {
  lat: number;
  lng: number;
  events: EventWithCoords[];
}

function groupByLatLng(events: EventWithCoords[]): EventGroup[] {
  const groups: Record<string, EventWithCoords[]> = {};
  
  events.forEach((event) => {
    const [lng, lat] = event.coordinates;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`; // 5 décimales ≈ 1 m
    groups[key] = groups[key] ? [...groups[key], event] : [event];
  });
  
  return Object.entries(groups).map(([key, evts]) => {
    const [lat, lng] = key.split(",").map(Number);
    // Tri chronologique
    evts.sort((a, b) =>
      dayjs(a.start_date).isAfter(dayjs(b.start_date)) ? 1 : -1
    );
    return { lat, lng, events: evts };
  });
}

interface EventsMapProps {
  events: Event[];
}

export const EventsMap = ({ events }: EventsMapProps) => {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const formatDate = (dateStr: string) => {
    return dayjs(dateStr).format('DD/MM/YY');
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map only once
    if (!mapRef.current) {
      const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
      
      const styleUrl = MAPTILER_KEY
        ? `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`
        // Fallback libre (Carto) si la clé est absente en dev
        : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

      if (!MAPTILER_KEY) {
        // eslint-disable-next-line no-console
        console.warn(
          "⚠️  VITE_MAPTILER_KEY manquant : la carte utilise le style Carto fallback. " +
          "Ajoute la clé MapTiler pour un rendu optimisé."
        );
      }

      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });

      mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Filter events with coordinates and add mock coordinates
    const eventsWithCoords: EventWithCoords[] = events
      .map(event => ({
        ...event,
        coordinates: getCityCoordinates(event.city)
      }))
      .filter(event => {
        const [lng, lat] = event.coordinates;
        return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
      });

    // Group events by coordinates
    const groupedEvents = groupByLatLng(eventsWithCoords);

    // Add markers for event groups
    groupedEvents.forEach(group => {
      const eventCount = group.events.length;
      
      // Create popup content with all events in the group
      const popupContent = `
        <div class="space-y-2 w-[280px] max-h-[400px] overflow-y-auto">
          <div class="font-semibold text-sm mb-2 text-gray-800">
            ${eventCount > 1 ? `${eventCount} événements à ce lieu` : 'Événement'}
          </div>
          ${group.events.map(event => `
            <div class="border-b border-gray-200 pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0">
              <img 
                src="${event.image_url || '/placeholder.svg'}" 
                alt="${event.name}"
                class="h-16 w-full object-cover rounded mb-1"
              />
              <div class="text-xs text-blue-600 mb-1">
                📅 ${formatDate(event.start_date)}${event.start_date !== event.end_date ? ` - ${formatDate(event.end_date)}` : ''}
              </div>
              <div class="font-medium text-sm text-gray-900 mb-1">${event.name}</div>
              <div class="text-xs text-gray-600 mb-1">${event.city}</div>
              <div class="text-xs text-blue-600 mb-1">${event.sector}</div>
              ${event.event_url ? `<a href="${event.event_url}" target="_blank" rel="noopener noreferrer" class="text-primary text-xs underline">Voir le salon →</a>` : ''}
            </div>
          `).join('')}
        </div>
      `;

      const popup = new maplibregl.Popup({
        offset: 25,
        maxWidth: '300px'
      }).setHTML(popupContent);

      // Create marker with badge if multiple events
      const markerElement = document.createElement('div');
      markerElement.className = 'relative';
      markerElement.innerHTML = `
        <div class="w-6 h-6 bg-[#e8552b] rounded-full border-2 border-white shadow-lg"></div>
        ${eventCount > 1 ? `
          <div class="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
            ${eventCount}
          </div>
        ` : ''}
      `;

      const marker = new maplibregl.Marker({
        element: markerElement
      })
        .setLngLat([group.lng, group.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit bounds if events are present
    if (groupedEvents.length > 0) {
      const coordinates = groupedEvents.map(g => [g.lng, g.lat] as [number, number]);
      
      if (coordinates.length === 1) {
        // Single group - moderate zoom
        map.setCenter(coordinates[0]);
        map.setZoom(8);
      } else {
        // Multiple groups - fit bounds
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
