
import { useState } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { FiltersSidebar } from '@/components/FiltersSidebar';
import { ViewToggle } from '@/components/ViewToggle';
import { EventsResults } from '@/components/EventsResults';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import type { SearchFilters } from '@/types/event';

const Events = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const { data: events, isLoading, error } = useEvents(filters);

  // Filter out 'loisir' events for display
  const displayEvents = events?.filter(event => event.event_type !== 'loisir') || [];

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

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
