
import Header from '@/components/Header';
import SearchSection from '@/components/SearchSection';
import FeaturesSection from '@/components/FeaturesSection';
import SectorsSection from '@/components/SectorsSection';
import RecentEventsSection from '@/components/RecentEventsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import { useNavigate } from 'react-router-dom';
import type { SearchFilters } from '@/types/event';

const Index = () => {
  const navigate = useNavigate();

  const handleSearch = (filters: SearchFilters) => {
    // Naviguer vers la page des événements avec les filtres
    const searchParams = new URLSearchParams();
    
    // Use sectorIds for new filtering, sectors for legacy support
    if (filters.sectorIds && filters.sectorIds.length > 0) {
      searchParams.set('sectors', filters.sectorIds.join(','));
    } else if (filters.sectors && filters.sectors.length > 0) {
      searchParams.set('sectors', filters.sectors.join(','));
    }
    
    if (filters.types && filters.types.length > 0) {
      searchParams.set('types', filters.types.join(','));
    }
    
    if (filters.months && filters.months.length > 0) {
      searchParams.set('months', filters.months.join(','));
    }
    
    // Nouvelle gestion standardisée de la localisation
    if (filters.locationSuggestion) {
      searchParams.set('location_type', filters.locationSuggestion.type);
      searchParams.set('location_value', filters.locationSuggestion.value);
    }
    
    navigate(`/events?${searchParams.toString()}`);
  };

  return (
    <div className="min-h-screen w-full px-6 mx-auto">
      <Header />
      <main>
        <SearchSection onSearch={handleSearch} />
        <FeaturesSection />
        <SectorsSection />
        <RecentEventsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
