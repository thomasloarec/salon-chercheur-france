
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/mapUtils';

export const useMaplibreMap = (containerRef: React.RefObject<HTMLDivElement>) => {
  const mapRef = useRef<maplibregl.Map | null>(null);

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

    return () => {
      // Cleanup map on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [containerRef]);

  return mapRef.current;
};
