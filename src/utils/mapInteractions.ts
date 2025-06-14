
import maplibregl from 'maplibre-gl';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClusterPopupContent } from '@/components/map/ClusterPopupContent';
import { EventPopupContent } from '@/components/map/EventPopupContent';

export const setupClusterInteractions = (map: maplibregl.Map) => {
  // Popup avec liste d'événements sur cluster au clic
  map.on('click', 'cluster-circle', (e) => {
    const feature = e.features?.[0];
    if (!feature) return;

    const clusterId = feature.properties?.cluster_id as number;
    const childCount = feature.properties?.point_count as number;
    const source = map.getSource('events') as maplibregl.GeoJSONSource;

    // Utilise la signature correcte : (clusterId, limit, callback)
    source.getClusterLeaves(clusterId, childCount, (err, leaves) => {
      if (err) {
        console.error('Error getting cluster leaves:', err);
        return;
      }

      // Tri chronologique
      const events = leaves.map((l) => l.properties);
      
      const html = renderToStaticMarkup(
        ClusterPopupContent({ events, count: childCount })
      );

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

  // Zoom sur cluster au double-clic
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
};

export const setupPointInteractions = (map: maplibregl.Map) => {
  // Popup pour les points individuels
  map.on('click', 'unclustered-point', (e) => {
    const feature = e.features?.[0];
    if (!feature || !feature.properties) return;

    const event = feature.properties;
    
    const html = renderToStaticMarkup(
      EventPopupContent({ event })
    );

    new maplibregl.Popup({
      offset: 25,
      maxWidth: '300px'
    })
      .setLngLat((feature.geometry as any).coordinates)
      .setHTML(html)
      .addTo(map);
  });
};

export const setupCursorEffects = (map: maplibregl.Map) => {
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
};
