
import { useState, useEffect, useCallback } from 'react';
import { useEventsWithRPC } from '@/hooks/useEventsWithRPC';
import { FiltersSidebar } from '@/components/FiltersSidebar';

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
  const [isInitialized, setIsInitialized] = useState(false);
  const { data: eventsData, isLoading, error } = useEventsWithRPC(filters);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Initialize filters from URL params ONCE
  useEffect(() => {
    if (!isInitialized) {
      const initialFilters: SearchFilters = {};
      
      const sectorsParam = searchParams.get('sectors');
      if (sectorsParam) {
        // Check if these are sector IDs (UUIDs) or names
        const sectorValues = sectorsParam.split(',');
        // Simple heuristic: if it looks like a UUID, treat as ID, otherwise as name
        const isUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (sectorValues.some(s => isUuidPattern.test(s))) {
          initialFilters.sectorIds = sectorValues;
        } else {
          initialFilters.sectors = sectorValues;
        }
      }
      
      const typesParam = searchParams.get('types');
      if (typesParam) {
        initialFilters.types = typesParam.split(',');
      }
      
      const monthsParam = searchParams.get('months');
      if (monthsParam) {
        // Handle both old format (numbers) and new format (month-year)
        initialFilters.months = monthsParam.split(',').map(m => {
          // If it contains a dash, extract the month part, otherwise use as is
          const monthValue = m.includes('-') ? m.split('-')[0] : m;
          return parseInt(monthValue);
        });
      }
      
      // ✅ CORRIGÉ: Gestion standardisée et simplifiée de la localisation
      const locationTypeParam = searchParams.get('location_type');
      const locationValueParam = searchParams.get('location_value');
      
      if (locationTypeParam && locationValueParam) {
        initialFilters.locationSuggestion = {
          type: locationTypeParam as 'department' | 'region' | 'city' | 'text',
          value: locationValueParam,
          label: locationValueParam
        };
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Events: Initial filters from URL:', initialFilters);
      }
      
      setFilters(initialFilters);
      setIsInitialized(true);
    }
  }, [searchParams, isInitialized]);

  // Display events from RPC response
  const displayEvents = eventsData?.events || [];

  // Memoize the callback to prevent infinite re-renders
  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    console.log('Events: Filters changed:', newFilters);
    setFilters(newFilters);
    
    // Update URL params
    const newParams = new URLSearchParams();
    
    // Preserve view parameter
    const currentView = searchParams.get('view');
    if (currentView) {
      newParams.set('view', currentView);
    }
    
    // Use sectorIds for new filtering, sectors for legacy support
    if (newFilters.sectorIds && newFilters.sectorIds.length > 0) {
      newParams.set('sectors', newFilters.sectorIds.join(','));
    } else if (newFilters.sectors && newFilters.sectors.length > 0) {
      newParams.set('sectors', newFilters.sectors.join(','));
    }
    
    if (newFilters.types && newFilters.types.length > 0) {
      newParams.set('types', newFilters.types.join(','));
    }
    
    if (newFilters.months && newFilters.months.length > 0) {
      newParams.set('months', newFilters.months.join(','));
    }
    
    // ✅ NETTOYÉ: Gestion standardisée de la localisation
    if (newFilters.locationSuggestion) {
      newParams.set('location_type', newFilters.locationSuggestion.type);
      newParams.set('location_value', newFilters.locationSuggestion.value);
    }
    
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

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
    <div className="min-h-screen w-full px-6 mx-auto">
      <Header />
      
      <div className="grid lg:grid-cols-[320px_1fr] min-h-[calc(100vh-200px)]">
        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky lg:top-[80px] lg:self-start lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto
          z-30 inset-y-0 left-0 w-80 lg:w-320px
          bg-white shadow-lg lg:shadow-none border-r transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <FiltersSidebar 
            onClose={() => setIsSidebarOpen(false)}
            onFiltersChange={handleFiltersChange}
            initialFilters={isInitialized ? filters : {}}
          />
        </aside>

        {/* Content */}
        <main className="p-4 lg:p-8 bg-gray-50">
          {/* Mobile menu button */}
          <div className="lg:hidden mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-4 w-4 mr-2" />
              Filtres
            </Button>
          </div>

          {/* Header with results count */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {isLoading ? 'Chargement...' : `${displayEvents.length || 0} salon(s) trouvé(s)`}
            </h1>
            {Object.keys(filters).length > 0 && (
              <p className="text-gray-600 mt-2">
                Résultats filtrés
                {filters.locationSuggestion && (
                  <span className="ml-2 text-accent font-medium">
                    • Lieu: {filters.locationSuggestion.label}
                  </span>
                )}
                {filters.sectors && filters.sectors.length > 0 && (
                  <span className="ml-2 text-accent font-medium">
                    • Secteur: {filters.sectors.join(', ')}
                  </span>
                )}
                {filters.types && filters.types.length > 0 && (
                  <span className="ml-2 text-accent font-medium">
                    • Type: {filters.types.join(', ')}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Results with month grouping */}
          <EventsResults events={displayEvents} isLoading={isLoading} />
        </main>
      </div>
      
      <Footer />
    </div>
  );
};

export default Events;
