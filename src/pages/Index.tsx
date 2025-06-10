
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
    
    if (filters.sectors && filters.sectors.length > 0) {
      searchParams.set('sectors', filters.sectors.join(','));
    }
    
    if (filters.months && filters.months.length > 0) {
      searchParams.set('months', filters.months.join(','));
    }
    
    if (filters.city) {
      searchParams.set('city', filters.city);
    }
    
    navigate(`/events?${searchParams.toString()}`);
  };

  return (
    <div className="min-h-screen">
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
