
import { useEffect, useRef } from 'react';
import type { Event } from '@/types/event';
import { useMaplibreMap } from '@/hooks/useMaplibreMap';
import { prepareEventsWithCoords } from '@/utils/mapUtils';
import { setupMapLayers } from '@/utils/mapLayers';

interface EventsMapProps {
  events: Event[];
}

export const EventsMap = ({ events }: EventsMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const map = useMaplibreMap(containerRef);

  useEffect(() => {
    if (!map) return;

    // Prepare events with coordinates
    const eventsWithCoords = prepareEventsWithCoords(events);

    // Setup map layers and interactions
    const cleanup = setupMapLayers(map, eventsWithCoords);

    return cleanup;
  }, [map, events]);

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden border">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
