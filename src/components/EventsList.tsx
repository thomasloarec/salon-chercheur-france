
import { useState } from 'react';
import { useEvents } from '@/hooks/useEvents';
import EventCard from './EventCard';
import SearchSection from './SearchSection';
import { Button } from '@/components/ui/button';
import { Calendar, Grid, List } from 'lucide-react';
import type { SearchFilters } from '@/types/event';

const EventsList = () => {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { data: events, isLoading, error } = useEvents(filters);

  const handleSearch = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Erreur lors du chargement des événements</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SearchSection onSearch={handleSearch} isLoading={isLoading} />
      
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-primary">
                {isLoading ? 'Chargement...' : `${events?.length || 0} salon(s) trouvé(s)`}
              </h2>
              {filters.query && (
                <p className="text-gray-600 mt-1">
                  Résultats pour "{filters.query}"
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
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
          ) : events && events.length > 0 ? (
            <div className={viewMode === 'grid' ? 
              'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 
              'space-y-4'
            }>
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Aucun salon trouvé
              </h3>
              <p className="text-gray-500">
                Essayez de modifier vos critères de recherche
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default EventsList;
