
import type { Event } from '@/types/event';

// Mock coordinates for demonstration - these would come from geocoding in the future
export const getCityCoordinates = (city: string): [number, number] => {
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

export interface EventWithCoords extends Event {
  coordinates: [number, number];
  lat: number;
  lng: number;
}

export const prepareEventsWithCoords = (events: Event[]): EventWithCoords[] => {
  return events
    .map(event => {
      const [lng, lat] = getCityCoordinates(event.ville);
      return {
        ...event,
        coordinates: [lng, lat] as [number, number],
        lat,
        lng
      };
    })
    .filter(event => {
      return typeof event.lat === 'number' && typeof event.lng === 'number' && 
             !isNaN(event.lat) && !isNaN(event.lng);
    });
};

export const toFeatureCollection = (events: EventWithCoords[]) => {
  return {
    type: "FeatureCollection" as const,
    features: events
      .filter(e => typeof e.lat === "number" && typeof e.lng === "number")
      .map(e => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          // IMPORTANT: [lng, lat] order without rounding
          coordinates: [e.lng, e.lat] as [number, number],
        },
        properties: {
          id: e.id,
          name: e.nom_event,
          start_date: e.date_debut,
          end_date: e.date_fin,
          city: e.ville,
          sector: e.secteur,
          event_url: e.url_site_officiel,
          image_url: e.url_image,
        },
      })),
  };
};

export const DEFAULT_CENTER: [number, number] = [2.4, 46.6]; // France centre (lng, lat)
export const DEFAULT_ZOOM = 5;
