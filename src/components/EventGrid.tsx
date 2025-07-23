import React from 'react';
import EventCard from './EventCard';
import type { Event } from '@/types/event';

interface EventGridProps {
  events: Event[];
  adminPreview?: boolean;
  onPublish?: (eventId: string) => void;
}

const EventGrid = ({ events, adminPreview = false, onPublish }: EventGridProps) => {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {adminPreview ? "Aucun événement en attente de publication" : "Aucun événement trouvé"}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {events.map((event) => (
        <EventCard 
          key={event.id} 
          event={event} 
          view="grid"
          adminPreview={adminPreview}
          onPublish={onPublish}
        />
      ))}
    </div>
  );
};

export default EventGrid;