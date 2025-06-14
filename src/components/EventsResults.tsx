
import { useSearchParams } from 'react-router-dom';
import EventCard from './EventCard';
import { EventsMap } from './EventsMap';
import { Calendar } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventsResultsProps {
  events?: Event[];
  isLoading: boolean;
}

export const EventsResults = ({ events = [], isLoading }: EventsResultsProps) => {
  const [searchParams] = useSearchParams();
  const currentView = searchParams.get('view') ?? 'grid';

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">
          Aucun salon trouvé
        </h3>
        <p className="text-gray-500">
          Essayez de modifier vos critères de recherche
        </p>
      </div>
    );
  }

  // Affichage conditionnel basé sur la vue actuelle
  if (currentView === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <EventCard key={event.id} event={event} view="grid" />
        ))}
      </div>
    );
  }
  
  if (currentView === 'list') {
    return (
      <div className="space-y-0 bg-white rounded-lg">
        {events.map((event) => (
          <EventCard key={event.id} event={event} view="list" />
        ))}
      </div>
    );
  }
  
  if (currentView === 'map') {
    return <EventsMap events={events} />;
  }

  // Fallback vers grid par défaut
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <EventCard key={event.id} event={event} view="grid" />
      ))}
    </div>
  );
};
