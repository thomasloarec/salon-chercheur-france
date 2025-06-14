
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
  lat: number;
  lng: number;
}

function toFeatureCollection(events: EventWithCoords[]) {
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
          name: e.name,
          start_date: e.start_date,
          end_date: e.end_date,
          city: e.city,
          sector: e.sector,
          event_url: e.event_url,
          image_url: e.image_url,
        },
      })),
  };
}

interface EventsMapProps {
  events: Event[];
}

export const EventsMap = ({ events }: EventsMapProps) => {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // Prepare events with coordinates
    const eventsWithCoords: EventWithCoords[] = events
      .map(event => {
        const [lng, lat] = getCityCoordinates(event.city);
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

    // Remove existing source and layers
    if (map.getSource('events')) {
      if (map.getLayer('cluster-circle')) map.removeLayer('cluster-circle');
      if (map.getLayer('cluster-count')) map.removeLayer('cluster-count');
      if (map.getLayer('unclustered-point')) map.removeLayer('unclustered-point');
      map.removeSource('events');
    }

    if (eventsWithCoords.length === 0) {
      // No events - show France
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
      return;
    }

    // Wait for map to be loaded before adding sources
    const addMapContent = () => {
      // Add GeoJSON source with clustering
      map.addSource('events', {
        type: 'geojson',
        data: toFeatureCollection(eventsWithCoords),
        cluster: true,
        clusterMaxZoom: 14, // au-delà, on affiche les points
        clusterRadius: 50, // px
      });

      // Style des clusters (badge chiffre)
      map.addLayer({
        id: 'cluster-circle',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#e8552b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            14, 10, 18, 30, 22
          ],
        },
      });

      // Texte compteur sur les clusters
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Points individuels avec icône pin
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#e8552b',
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Interaction - Popup avec liste d'événements sur cluster au clic
      map.on('click', 'cluster-circle', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const clusterId = feature.properties?.cluster_id as number;
        const childCount = feature.properties?.point_count as number;
        const source = map.getSource('events') as maplibregl.GeoJSONSource;

        // Utilise la signature correcte : (clusterId, limit, offset, callback)
        source.getClusterLeaves(clusterId, childCount, 0, (err, leaves) => {
          if (err) {
            console.error('Error getting cluster leaves:', err);
            return;
          }

          // Tri chronologique
          const sorted = leaves
            .map((l) => l.properties)
            .sort((a, b) =>
              dayjs(a.start_date).isAfter(dayjs(b.start_date)) ? 1 : -1
            );

          // Construire le HTML
          const html = `
            <div class="max-w-[320px] max-h-[300px] overflow-y-auto">
              <div class="font-medium text-sm mb-2 text-gray-900">${childCount} événement(s)</div>
              ${sorted
                .map(
                  (ev) => `
                  <div class="mb-2 pb-2 border-b border-gray-200 last:border-b-0">
                    <div class="text-xs text-blue-600 mb-1">
                      📅 ${dayjs(ev.start_date).format('DD/MM/YY')}${ev.start_date !== ev.end_date ? ` - ${dayjs(ev.end_date).format('DD/MM/YY')}` : ''}
                    </div>
                    <div class="font-medium text-sm text-gray-900 mb-1">${ev.name}</div>
                    <div class="text-xs text-gray-600 mb-1">${ev.city}</div>
                    <div class="text-xs text-blue-600 mb-1">${ev.sector}</div>
                    ${ev.event_url ? `<a href="${ev.event_url}" target="_blank" rel="noopener noreferrer" class="text-primary text-xs underline">Voir le salon →</a>` : ''}
                  </div>`
                )
                .join('')}
            </div>
          `;

          // Obtenir les coordonnées depuis la géométrie
          const geometry = feature.geometry;
          let coordinates: [number, number];
          
          if (geometry.type === 'Point') {
            coordinates = geometry.coordinates as [number, number];
          } else {
            console.error('Unexpected geometry type:', geometry.type);
            return;
          }

          new maplibregl.Popup({ 
            offset: 25,
            maxWidth: '350px',
            className: 'cluster-popup'
          })
            .setLngLat(coordinates)
            .setHTML(html)
            .addTo(map);
        });
      });

      // Interaction optionnelle - Zoom sur cluster au double-clic
      map.on('dblclick', 'cluster-circle', async (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['cluster-circle']
        });
        const clusterId = features[0].properties?.cluster_id;
        if (clusterId !== undefined) {
          try {
            const zoom = await (map.getSource('events') as maplibregl.GeoJSONSource).getClusterExpansionZoom(clusterId);
            // Obtenir les coordonnées depuis la géométrie
            const geometry = features[0].geometry;
            let coordinates: [number, number];
            
            if (geometry.type === 'Point') {
              coordinates = geometry.coordinates as [number, number];
            } else {
              console.error('Unexpected geometry type:', geometry.type);
              return;
            }
            
            map.easeTo({
              center: coordinates,
              zoom: zoom,
            });
          } catch (err) {
            console.error('Error getting cluster expansion zoom:', err);
          }
        }
      });

      // Popup pour les points individuels
      map.on('click', 'unclustered-point', (e) => {
        const feature = e.features?.[0];
        if (!feature || !feature.properties) return;

        const { id, name, start_date, end_date, city, sector, event_url, image_url } = feature.properties;
        
        const popupContent = `
          <div class="w-[280px]">
            <img 
              src="${image_url || '/placeholder.svg'}" 
              alt="${name}"
              class="h-16 w-full object-cover rounded mb-2"
            />
            <div class="text-xs text-blue-600 mb-1">
              📅 ${formatDate(start_date)}${start_date !== end_date ? ` - ${formatDate(end_date)}` : ''}
            </div>
            <div class="font-medium text-sm text-gray-900 mb-1">${name}</div>
            <div class="text-xs text-gray-600 mb-1">${city}</div>
            <div class="text-xs text-blue-600 mb-1">${sector}</div>
            ${event_url ? `<a href="${event_url}" target="_blank" rel="noopener noreferrer" class="text-primary text-xs underline">Voir le salon →</a>` : ''}
          </div>
        `;

        new maplibregl.Popup({
          offset: 25,
          maxWidth: '300px'
        })
          .setLngLat((feature.geometry as any).coordinates)
          .setHTML(popupContent)
          .addTo(map);
      });

      // Curseur pointer sur les éléments interactifs
      map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
      });
      
      map.on('mouseenter', 'cluster-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', 'cluster-circle', () => {
        map.getCanvas().style.cursor = '';
      });

      // Fit bounds if events are present
      if (eventsWithCoords.length > 0) {
        const coordinates = eventsWithCoords.map(e => [e.lng, e.lat] as [number, number]);
        
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
      }
    };

    if (map.isStyleLoaded()) {
      addMapContent();
    } else {
      map.on('load', addMapContent);
    }

    return () => {
      // Cleanup on unmount
      if (map.getSource('events')) {
        if (map.getLayer('cluster-circle')) map.removeLayer('cluster-circle');
        if (map.getLayer('cluster-count')) map.removeLayer('cluster-count');
        if (map.getLayer('unclustered-point')) map.removeLayer('unclustered-point');
        map.removeSource('events');
      }
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
