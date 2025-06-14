
import maplibregl from 'maplibre-gl';
import dayjs from 'dayjs';
import { renderClusterPopup, renderEventPopup } from './mapPopupRenderers';

export const setupMapInteractions = (
  map: maplibregl.Map,
  eventsWithCoords: any[]
) => {
  // Handle cluster clicks - show popup with event list (no zoom)
  const handleClusterClick = (e: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  } & Object) => {
    const feature = e.features?.[0];
    if (!feature || !feature.properties) return;

    const clusterId = feature.properties.cluster_id as number;
    const pointCount = feature.properties.point_count as number;
    const source = map.getSource('events') as maplibregl.GeoJSONSource;

    // Correct signature: (clusterId, callback)
    source.getClusterLeaves(
      clusterId,
      (err: any, leaves: any) => {
        if (err) {
          console.error('Error getting cluster leaves:', err);
          return;
        }

        const clusterEvents = leaves
          .map((leaf: any) => leaf.properties)
          .filter((props: any) => props && props.id)
          .sort((a: any, b: any) => 
            dayjs(a.start_date).isAfter(dayjs(b.start_date)) ? 1 : -1
          );

        const popupContent = renderClusterPopup(clusterEvents, pointCount);
        
        // Cast geometry to Point to access coordinates
        const geometry = feature.geometry as GeoJSON.Point;
        
        new maplibregl.Popup({ offset: 14 })
          .setLngLat(geometry.coordinates as [number, number])
          .setHTML(popupContent)
          .addTo(map);
      }
    );
  };

  // Handle individual event clicks
  const handleEventClick = (e: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  } & Object) => {
    const feature = e.features?.[0];
    if (!feature || !feature.properties) return;

    const eventProps = feature.properties;
    const popupContent = renderEventPopup(eventProps);
    
    // Cast geometry to Point to access coordinates
    const geometry = feature.geometry as GeoJSON.Point;
    
    new maplibregl.Popup({ offset: 14 })
      .setLngLat(geometry.coordinates as [number, number])
      .setHTML(popupContent)
      .addTo(map);
  };

  // Handle cluster double-click for zoom
  const handleClusterDoubleClick = (e: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  } & Object) => {
    const feature = e.features?.[0];
    if (!feature || !feature.properties) return;

    const clusterId = feature.properties.cluster_id as number;
    const source = map.getSource('events') as maplibregl.GeoJSONSource;

    // Correct signature: (clusterId, callback)
    source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
      if (err) {
        console.error('Error getting cluster expansion zoom:', err);
        return;
      }
      
      // Cast geometry to Point to access coordinates
      const geometry = feature.geometry as GeoJSON.Point;
      
      map.easeTo({
        center: geometry.coordinates as [number, number],
        zoom: zoom
      });
    });
  };

  // Add event listeners
  map.on('click', 'cluster-circle', handleClusterClick);
  map.on('click', 'unclustered-point', handleEventClick);
  map.on('dblclick', 'cluster-circle', handleClusterDoubleClick);

  // Return cleanup function
  return () => {
    map.off('click', 'cluster-circle', handleClusterClick);
    map.off('click', 'unclustered-point', handleEventClick);
    map.off('dblclick', 'cluster-circle', handleClusterDoubleClick);
  };
};

// Separate functions for cursor effects
export const setupCursorEffects = (map: maplibregl.Map) => {
  // Change cursor on hover for clusters
  map.on('mouseenter', 'cluster-circle', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'cluster-circle', () => {
    map.getCanvas().style.cursor = '';
  });

  // Change cursor on hover for individual points
  map.on('mouseenter', 'unclustered-point', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'unclustered-point', () => {
    map.getCanvas().style.cursor = '';
  });

  return () => {
    map.off('mouseenter', 'cluster-circle');
    map.off('mouseleave', 'cluster-circle');
    map.off('mouseenter', 'unclustered-point');
    map.off('mouseleave', 'unclustered-point');
  };
};

// Export individual setup functions for better modularity
export const setupClusterInteractions = (map: maplibregl.Map) => {
  const handleClusterClick = (e: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  } & Object) => {
    const feature = e.features?.[0];
    if (!feature || !feature.properties) return;

    const clusterId = feature.properties.cluster_id as number;
    const pointCount = feature.properties.point_count as number;
    const source = map.getSource('events') as maplibregl.GeoJSONSource;

    source.getClusterLeaves(clusterId, (err: any, leaves: any) => {
      if (err) {
        console.error('Error getting cluster leaves:', err);
        return;
      }

      const clusterEvents = leaves
        .map((leaf: any) => leaf.properties)
        .filter((props: any) => props && props.id)
        .sort((a: any, b: any) => 
          dayjs(a.start_date).isAfter(dayjs(b.start_date)) ? 1 : -1
        );

      const popupContent = renderClusterPopup(clusterEvents, pointCount);
      const geometry = feature.geometry as GeoJSON.Point;
      
      new maplibregl.Popup({ offset: 14 })
        .setLngLat(geometry.coordinates as [number, number])
        .setHTML(popupContent)
        .addTo(map);
    });
  };

  const handleClusterDoubleClick = (e: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  } & Object) => {
    const feature = e.features?.[0];
    if (!feature || !feature.properties) return;

    const clusterId = feature.properties.cluster_id as number;
    const source = map.getSource('events') as maplibregl.GeoJSONSource;

    source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
      if (err) {
        console.error('Error getting cluster expansion zoom:', err);
        return;
      }
      
      const geometry = feature.geometry as GeoJSON.Point;
      
      map.easeTo({
        center: geometry.coordinates as [number, number],
        zoom: zoom
      });
    });
  };

  map.on('click', 'cluster-circle', handleClusterClick);
  map.on('dblclick', 'cluster-circle', handleClusterDoubleClick);

  return () => {
    map.off('click', 'cluster-circle', handleClusterClick);
    map.off('dblclick', 'cluster-circle', handleClusterDoubleClick);
  };
};

export const setupPointInteractions = (map: maplibregl.Map) => {
  const handleEventClick = (e: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  } & Object) => {
    const feature = e.features?.[0];
    if (!feature || !feature.properties) return;

    const eventProps = feature.properties;
    const popupContent = renderEventPopup(eventProps);
    const geometry = feature.geometry as GeoJSON.Point;
    
    new maplibregl.Popup({ offset: 14 })
      .setLngLat(geometry.coordinates as [number, number])
      .setHTML(popupContent)
      .addTo(map);
  };

  map.on('click', 'unclustered-point', handleEventClick);

  return () => {
    map.off('click', 'unclustered-point', handleEventClick);
  };
};
