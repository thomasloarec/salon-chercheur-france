import React from 'react';
import EventCard from './EventCard';
import type { Event } from '@/types/event';

interface EventGridProps {
  events: Event[];
  adminPreview?: boolean;
  onPublish?: (eventId: string) => void;
  /** Contenu additionnel rendu sous chaque carte (ex : case admin). */
  renderCardExtra?: (event: Event) => React.ReactNode;
}

const EventGrid = ({ events, adminPreview = false, onPublish, renderCardExtra }: EventGridProps) => {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {adminPreview ? "Aucun événement en attente de publication" : "Aucun événement trouvé"}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {events.map((event) => (
        <div key={event.id} className="flex flex-col gap-2 min-w-0">
          <EventCard 
            event={event} 
            view="grid"
            adminPreview={adminPreview}
            onPublish={onPublish}
          />
          {renderCardExtra?.(event)}
        </div>
      ))}
    </div>
  );
};

export default EventGrid;
