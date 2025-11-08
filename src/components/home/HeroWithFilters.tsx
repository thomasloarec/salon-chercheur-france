import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Calendar, Building2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSectors } from '@/hooks/useSectors';
import { MultiSelect } from '@/components/ui/multi-select';
import { useQuery } from '@tanstack/react-query';
import { fetchAllRegions } from '@/lib/filtersData';

const HeroWithFilters = () => {
  const navigate = useNavigate();
  const { data: sectors = [] } = useSectors();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string[]>([]);

  const { data: regions = [] } = useQuery({
    queryKey: ['regions-options'],
    queryFn: fetchAllRegions,
    staleTime: 300_000,
  });

  const sectorOptions = sectors.map(s => ({
    value: s.id,
    label: s.name,
  }));

  const typeOptions = [
    { value: 'salon', label: 'Salon' },
    { value: 'congres', label: 'Congrès' },
    { value: 'forum', label: 'Forum' },
    { value: 'conference', label: 'Conférence' },
  ];

  const monthOptions = [
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
  ];

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedSectors.length > 0) params.set('sectors', selectedSectors.join(','));
    if (selectedType.length > 0) params.set('type', selectedType[0]);
    if (selectedMonth.length > 0) params.set('month', selectedMonth[0]);
    if (selectedRegion.length > 0) params.set('region', selectedRegion[0]);
    
    navigate(`/events?${params.toString()}`);
  };

  return (
    <section className="gradient-hero text-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Tous les salons professionnels
            <span className="block text-accent">en un seul endroit</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-4xl mx-auto text-gray-200">
            Découvrez en un coup d'œil les événements B2B près de chez vous, filtrés par secteur, date et région — le tout au même endroit.
          </p>
        </div>

        {/* Filters Bar - Meetup style */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl p-4 shadow-2xl animate-scale-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Nom du salon, secteur..."
                className="pl-10 h-12 text-gray-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <MultiSelect
              options={sectorOptions}
              selected={selectedSectors}
              onChange={setSelectedSectors}
              placeholder="Secteur d'activité"
              className="h-12"
            />

            <MultiSelect
              options={typeOptions}
              selected={selectedType}
              onChange={(values) => setSelectedType(values.slice(0, 1))}
              placeholder="Type d'événement"
              className="h-12"
            />

            <MultiSelect
              options={monthOptions}
              selected={selectedMonth}
              onChange={(values) => setSelectedMonth(values.slice(0, 1))}
              placeholder="Mois"
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MultiSelect
              options={regions}
              selected={selectedRegion}
              onChange={(values) => setSelectedRegion(values.slice(0, 1))}
              placeholder="Région"
              className="h-12"
            />

            <Button 
              onClick={handleSearch}
              className="w-full h-12 bg-accent hover:bg-accent/90 text-lg font-semibold"
            >
              <Search className="mr-2 h-5 w-5" />
              Rechercher
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroWithFilters;
