
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { FiltersSidebar } from '@/components/FiltersSidebar';
import { ViewToggle } from '@/components/ViewToggle';
import { EventsResults } from '@/components/EventsResults';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { SearchFilters } from '@/types/event';

const Events = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: events, isLoading, error } = useEvents(filters);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Initialize filters from URL params
  useEffect(() => {
    const initialFilters: SearchFilters = {};
    
    const sectorsParam = searchParams.get('sectors');
    if (sectorsParam) {
      initialFilters.sectors = sectorsParam.split(',');
    }
    
    const typesParam = searchParams.get('types');
    if (typesParam) {
      initialFilters.types = typesParam.split(',');
    }
    
    const monthsParam = searchParams.get('months');
    if (monthsParam) {
      initialFilters.months = monthsParam.split(',').map(m => parseInt(m));
    }
    
    const cityParam = searchParams.get('city');
    if (cityParam) {
      initialFilters.city = cityParam;
    }
    
    console.log('Initial filters from URL:', initialFilters);
    setFilters(initialFilters);
  }, [searchParams]);

  // Filter out 'loisir' events for display
  const displayEvents = events?.filter(event => event.event_type !== 'loisir') || [];

  // Memoize the callback to prevent infinite re-renders
  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    console.log('Filters changed:', newFilters);
    setFilters(newFilters);
    
    // Update URL params
    const newParams = new URLSearchParams();
    
    // Preserve view parameter
    const currentView = searchParams.get('view');
    if (currentView) {
      newParams.set('view', currentView);
    }
    
    if (newFilters.sectors && newFilters.sectors.length > 0) {
      newParams.set('sectors', newFilters.sectors.join(','));
    }
    
    if (newFilters.types && newFilters.types.length > 0) {
      newParams.set('types', newFilters.types.join(','));
    }
    
    if (newFilters.months && newFilters.months.length > 0) {
      newParams.set('months', newFilters.months.join(','));
    }
    
    if (newFilters.city) {
      newParams.set('city', newFilters.city);
    }
    
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Memoize initial filters to prevent unnecessary re-renders
  const memoizedInitialFilters = useMemo(() => filters, [
    filters.sectors?.join(','),
    filters.types?.join(','), 
    filters.months?.join(','),
    filters.city
  ]);

  if (error) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="py-12">
          <div className="text-center">
            <p className="text-red-600">Erreur lors du chargement des événements</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="grid md:grid-cols-[280px_1fr] min-h-[calc(100vh-200px)]">
        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <aside className={`
          fixed md:static z-30 inset-y-0 left-0 w-72 md:w-full
          bg-white shadow-md transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <FiltersSidebar 
            onClose={() => setIsSidebarOpen(false)}
            onFiltersChange={handleFiltersChange}
            initialFilters={memoizedInitialFilters}
          />
        </aside>

        {/* Content */}
        <main className="p-4 md:p-6 bg-gray-50">
          {/* Mobile menu button */}
          <div className="md:hidden mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-4 w-4 mr-2" />
              Filtres
            </Button>
          </div>

          {/* Header with results count and view toggle */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isLoading ? 'Chargement...' : `${displayEvents.length || 0} salon(s) trouvé(s)`}
              </h1>
              {Object.keys(filters).length > 0 && (
                <p className="text-gray-600 mt-1">
                  Résultats filtrés
                  {filters.sectors && filters.sectors.length > 0 && (
                    <span className="ml-2 text-accent font-medium">
                      • Secteur: {filters.sectors.join(', ')}
                    </span>
                  )}
                </p>
              )}
            </div>
            
            <ViewToggle />
          </div>

          {/* Results */}
          <EventsResults events={displayEvents} isLoading={isLoading} />
        </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default Events;
