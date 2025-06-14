
import maplibregl from 'maplibre-gl';
import type { EventWithCoords } from '@/utils/mapUtils';
import { toFeatureCollection, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/mapUtils';
import { setupClusterInteractions, setupPointInteractions, setupCursorEffects } from './mapInteractions';

export const setupMapLayers = (map: maplibregl.Map, eventsWithCoords: EventWithCoords[]) => {
  // Add safety check for map
  if (!map) {
    console.error('Map instance is undefined');
    return () => {};
  }

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
    return () => {};
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

    // Setup interactions only after layers are added
    const cleanupCluster = setupClusterInteractions(map);
    const cleanupPoint = setupPointInteractions(map);
    const cleanupCursor = setupCursorEffects(map);

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

    // Return combined cleanup function
    return () => {
      cleanupCluster();
      cleanupPoint();
      cleanupCursor();
      // Cleanup layers and source on unmount
      if (map.getSource('events')) {
        if (map.getLayer('cluster-circle')) map.removeLayer('cluster-circle');
        if (map.getLayer('cluster-count')) map.removeLayer('cluster-count');
        if (map.getLayer('unclustered-point')) map.removeLayer('unclustered-point');
        map.removeSource('events');
      }
    };
  };

  if (map.isStyleLoaded()) {
    return addMapContent();
  } else {
    let cleanup: (() => void) | undefined;
    const onLoad = () => {
      cleanup = addMapContent();
    };
    map.on('load', onLoad);
    
    return () => {
      map.off('load', onLoad);
      if (cleanup) cleanup();
    };
  }
};
