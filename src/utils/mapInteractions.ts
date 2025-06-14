
import type { Map as MaplibreMap, MapLayerMouseEvent, GeoJSONSource } from 'maplibre-gl';
import { renderEventPopup, renderClusterPopup } from './mapPopupRenderers';

export const setupMapInteractions = (map: MaplibreMap) => {
  // Change cursor on hover
  map.on('mouseenter', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = '';
  });

  map.on('mouseenter', 'unclustered-point', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'unclustered-point', () => {
    map.getCanvas().style.cursor = '';
  });

  // Click handler for clusters
  map.on('click', 'clusters', (e: MapLayerMouseEvent) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['clusters']
    });

    if (!features.length) return;

    const clusterId = features[0].properties?.cluster_id;
    const source = map.getSource('events') as GeoJSONSource;
    
    if (source && source.getClusterExpansionZoom && clusterId) {
      source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return;

        map.easeTo({
          center: (features[0].geometry as any).coordinates,
          zoom: zoom
        });
      });
    }
  });

  // Click handler for individual events
  map.on('click', 'unclustered-point', (e: MapLayerMouseEvent) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['unclustered-point']
    });

    if (!features.length) return;

    const feature = features[0];
    const coordinates = (feature.geometry as any).coordinates.slice();
    
    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    renderEventPopup(map, coordinates, feature.properties);
  });

  // Show cluster popup on hover
  map.on('mouseenter', 'clusters', (e: MapLayerMouseEvent) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['clusters']
    });

    if (!features.length) return;

    const feature = features[0];
    const clusterId = feature.properties?.cluster_id;
    const pointCount = feature.properties?.point_count;
    const coordinates = (feature.geometry as any).coordinates.slice();
    const source = map.getSource('events') as GeoJSONSource;

    if (source && source.getClusterLeaves && clusterId && pointCount) {
      source.getClusterLeaves(clusterId, pointCount, 0, (err: any, leaves: any) => {
        if (err) return;
        
        renderClusterPopup(map, coordinates, leaves);
      });
    }
  });

  // Hide popup on mouse leave
  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = '';
    
    // Remove existing popups
    const popups = document.getElementsByClassName('maplibregl-popup');
    Array.from(popups).forEach(popup => popup.remove());
  });
};

// Export individual setup functions for compatibility
export const setupClusterInteractions = (map: MaplibreMap) => {
  // Click handler for clusters
  const clusterClickHandler = (e: MapLayerMouseEvent) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['clusters']
    });

    if (!features.length) return;

    const clusterId = features[0].properties?.cluster_id;
    const source = map.getSource('events') as GeoJSONSource;
    
    if (source && source.getClusterExpansionZoom && clusterId) {
      source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return;

        map.easeTo({
          center: (features[0].geometry as any).coordinates,
          zoom: zoom
        });
      });
    }
  };

  map.on('click', 'clusters', clusterClickHandler);

  return () => {
    map.off('click', 'clusters', clusterClickHandler);
  };
};

export const setupPointInteractions = (map: MaplibreMap) => {
  // Click handler for individual events
  const pointClickHandler = (e: MapLayerMouseEvent) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['unclustered-point']
    });

    if (!features.length) return;

    const feature = features[0];
    const coordinates = (feature.geometry as any).coordinates.slice();
    
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    renderEventPopup(map, coordinates, feature.properties);
  };

  map.on('click', 'unclustered-point', pointClickHandler);

  return () => {
    map.off('click', 'unclustered-point', pointClickHandler);
  };
};

export const setupCursorEffects = (map: MaplibreMap) => {
  // Change cursor on hover handlers
  const clusterMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };

  const clusterMouseLeave = () => {
    map.getCanvas().style.cursor = '';
  };

  const pointMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };

  const pointMouseLeave = () => {
    map.getCanvas().style.cursor = '';
  };

  map.on('mouseenter', 'clusters', clusterMouseEnter);
  map.on('mouseleave', 'clusters', clusterMouseLeave);
  map.on('mouseenter', 'unclustered-point', pointMouseEnter);
  map.on('mouseleave', 'unclustered-point', pointMouseLeave);

  return () => {
    map.off('mouseenter', 'clusters', clusterMouseEnter);
    map.off('mouseleave', 'clusters', clusterMouseLeave);
    map.off('mouseenter', 'unclustered-point', pointMouseEnter);
    map.off('mouseleave', 'unclustered-point', pointMouseLeave);
  };
};
