import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { Search } from 'lucide-react';
import { useSectors } from '@/hooks/useSectors';
import { useHomeStats } from '@/hooks/useHomeStats';
import { getRollingMonths } from '@/utils/monthUtils';
import { EVENT_TYPES } from '@/constants/eventTypes';
import type { SearchFilters } from '@/types/event';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface SearchSectionProps {
  onSearch: (filters: SearchFilters) => void;
}

const SearchSection = ({ onSearch }: SearchSectionProps) => {
  const [sectors, setSectors] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [locationValue, setLocationValue] = useState<string>('');
  const [regions, setRegions] = useState<{ code: string; nom: string }[]>([]);
  const navigate = useNavigate();

  const { data: sectorsData = [] } = useSectors();
  const { data: stats, isLoading } = useHomeStats();

  // Load regions
  useEffect(() => {
    supabase
      .from('regions')
      .select('code, nom')
      .order('nom', { ascending: true })
      .then(({ data }) => data && setRegions(data));
  }, []);

  // Create sector options using IDs as values
  const sectorOptions = useMemo(() => 
    sectorsData.map(sector => ({
      value: sector.id,
      label: sector.name,
    })), [sectorsData]
  );

  // Create rolling months options
  const monthOptions = useMemo(() => 
    getRollingMonths(12).map(monthOption => ({
      value: `${monthOption.month}-${monthOption.year}`,
      label: monthOption.label,
    })), []
  );

  const navigateToResults = () => {
    // Build search params
    const searchParams = new URLSearchParams();
    
    if (sectors.length > 0) {
      searchParams.set('sectors', sectors.join(','));
    }
    
    if (types.length > 0) {
      searchParams.set('types', types.join(','));
    }
    
    if (months.length > 0) {
      searchParams.set('months', months.join(','));
    }
    
    // Handle region selection
    if (locationValue) {
      searchParams.set('location_type', 'region');
      searchParams.set('location_value', locationValue);
      console.log('🔍 Recherche avec région:', locationValue);
    }
    
    searchParams.set('page', '1');
    
    // Navigate to events page
    navigate({
      pathname: '/events',
      search: searchParams.toString()
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔍 Form submitted');
    navigateToResults();
  };

  return (
    <section className="gradient-hero text-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center animate-fade-in-up">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Tous les salons professionnels
            <span className="block text-accent">en un seul endroit</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-gray-200">
            Ne manquez plus jamais une opportunité business. Découvrez tous les événements B2B en France, 
            filtrés par secteur d'activité et géolocalisation. Accès libre et gratuit.
          </p>

          {/* Search Form */}
          <form onSubmit={handleFormSubmit} className="max-w-4xl mx-auto bg-white rounded-lg p-6 shadow-2xl animate-scale-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Secteurs d'activité</label>
                <MultiSelect
                  options={sectorOptions}
                  selected={sectors}
                  onChange={setSectors}
                  placeholder="Sélectionner des secteurs..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type d'événement</label>
                <MultiSelect
                  options={EVENT_TYPES}
                  selected={types}
                  onChange={setTypes}
                  placeholder="Sélectionner des types..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mois</label>
                <MultiSelect
                  options={monthOptions}
                  selected={months}
                  onChange={setMonths}
                  placeholder="Sélectionner des mois..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Région</label>
                <MultiSelect
                  options={regions.map(r => ({ value: r.code, label: r.nom }))}
                  selected={locationValue ? [locationValue] : []}
                  onChange={vals => setLocationValue(vals[0] || '')}
                  placeholder="Sélectionner une région..."
                  className="w-full"
                />
              </div>
            </div>

            <Button 
              type="submit"
              className="w-full h-12 bg-accent hover:bg-accent/90 text-lg font-semibold"
            >
              <Search className="h-5 w-5 mr-2" />
              Rechercher des salons
            </Button>
          </form>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent">
                {isLoading ? '...' : `${stats?.totalEvents || 0}`}
              </div>
              <div className="text-gray-300 mt-2">Salons référencés</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent">
                {isLoading ? '...' : `${stats?.totalSectors || 0}`}
              </div>
              <div className="text-gray-300 mt-2">Secteurs d'activité</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent">100%</div>
              <div className="text-gray-300 mt-2">Gratuit</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchSection;
