
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import EventCard from './EventCard';
import { Calendar } from 'lucide-react';
import type { Event } from '@/types/event';
import { groupEventsByMonth } from '@/utils/eventGrouping';

interface EventsResultsProps {
  events: Event[];
  isLoading: boolean;
}

export const EventsResults = ({ events, isLoading }: EventsResultsProps) => {
  const [searchParams] = useSearchParams();
  const viewMode = searchParams.get('view') || 'grid';

  // Regrouper les événements par mois
  const groupedEvents = useMemo(() => {
    if (!events || events.length === 0) return [];
    
    // Les événements sont déjà triés par date côté DB, 
    // mais on s'assure du tri côté client aussi
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
    );
    
    return groupEventsByMonth(sortedEvents);
  }, [events]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-6 animate-pulse">
            <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
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

  return (
    <div className="space-y-10">
      {groupedEvents.map(({ monthLabel, events: monthEvents }) => (
        <section key={monthLabel} className="border-t border-gray-200 pt-8 first:border-t-0 first:pt-0">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 capitalize">
            {monthLabel}
          </h2>
          <div className={viewMode === 'grid' ? 
            'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 
            'space-y-4'
          }>
            {monthEvents.map((event) => (
              <EventCard key={event.id} event={event} view={viewMode as 'grid'} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
