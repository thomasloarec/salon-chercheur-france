
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MapPin, Filter } from 'lucide-react';
import { useSectors } from '@/hooks/useSectors';
import { MultiSelect } from '@/components/ui/multi-select';
import { eachMonthOfInterval, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EVENT_TYPES } from '@/constants/eventTypes';
import type { SearchFilters } from '@/types/event';

interface SearchSectionProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading?: boolean;
}

const SearchSection = ({ onSearch, isLoading }: SearchSectionProps) => {
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [city, setCity] = useState('');
  
  const { data: sectors } = useSectors();

  // Générer la liste des mois (mois restants de l'année + année suivante)
  const months = eachMonthOfInterval({
    start: new Date(),
    end: new Date(new Date().getFullYear() + 1, 11, 31)
  }).map(date => ({
    value: date.getMonth() + 1,
    label: format(date, 'MMMM yyyy', { locale: fr })
  }));

  const handleSearch = () => {
    onSearch({
      sectors: selectedSectors,
      types: selectedTypes,
      months: selectedMonths,
      city: city || undefined,
    });
  };

  const handleReset = () => {
    setSelectedSectors([]);
    setSelectedTypes([]);
    setSelectedMonths([]);
    setCity('');
    onSearch({});
  };

  const sectorOptions = sectors?.map(sector => ({
    value: sector.name,
    label: sector.name
  })) || [];

  const monthOptions = months.map(month => ({
    value: month.value.toString(),
    label: month.label
  }));

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-primary mb-4">
            Recherche avancée de salons
          </h2>
          <p className="text-xl text-gray-600">
            Trouvez facilement les événements professionnels qui vous intéressent
          </p>
        </div>

        <Card className="p-6">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Secteurs - MultiSelect */}
              <div>
                <MultiSelect
                  label="Secteurs d'activité"
                  options={sectorOptions}
                  selected={selectedSectors}
                  onChange={setSelectedSectors}
                  placeholder="Choisissez un ou plusieurs secteurs"
                />
              </div>

              {/* Types - MultiSelect */}
              <div>
                <MultiSelect
                  label="Type d'événement"
                  options={EVENT_TYPES}
                  selected={selectedTypes}
                  onChange={setSelectedTypes}
                  placeholder="Tous les types"
                />
              </div>

              {/* Ville */}
              <div className="relative">
                <label className="text-sm font-medium leading-none mb-2 block">
                  Ville / Région
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Ville ou région"
                    className="pl-10"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>

              {/* Mois - MultiSelect */}
              <div>
                <MultiSelect
                  label="Mois"
                  options={monthOptions}
                  selected={selectedMonths.map(m => m.toString())}
                  onChange={(values) => setSelectedMonths(values.map(v => parseInt(v)))}
                  placeholder="Tous les mois"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button 
                onClick={handleSearch} 
                disabled={isLoading || selectedSectors.length === 0}
                className="bg-accent hover:bg-accent/90"
              >
                <Search className="h-4 w-4 mr-2" />
                Rechercher
              </Button>
              <Button 
                variant="outline" 
                onClick={handleReset}
                disabled={isLoading}
              >
                <Filter className="h-4 w-4 mr-2" />
                Réinitialiser
              </Button>
            </div>

            {selectedSectors.length === 0 && (
              <p className="text-sm text-gray-500 text-center mt-2">
                Veuillez sélectionner au moins un secteur d'activité
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default SearchSection;
