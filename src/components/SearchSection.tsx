
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MapPin, Calendar, Filter, Users } from 'lucide-react';
import { useSectors } from '@/hooks/useEvents';
import type { SearchFilters } from '@/types/event';

interface SearchSectionProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading?: boolean;
}

const SearchSection = ({ onSearch, isLoading }: SearchSectionProps) => {
  const [filters, setFilters] = useState<SearchFilters>({});
  const { data: sectors } = useSectors();

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters({});
    onSearch({});
  };

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Recherche textuelle */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Nom du salon, mots-clés..."
                  className="pl-10"
                  value={filters.query || ''}
                  onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                />
              </div>

              {/* Secteur */}
              <Select 
                value={filters.sector || ''} 
                onValueChange={(value) => setFilters({ ...filters, sector: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Secteur d'activité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les secteurs</SelectItem>
                  {sectors?.map((sector) => (
                    <SelectItem key={sector.id} value={sector.name}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Ville */}
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Ville"
                  className="pl-10"
                  value={filters.city || ''}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                />
              </div>

              {/* Date de début */}
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="date"
                  placeholder="Date de début"
                  className="pl-10"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>

              {/* Date de fin */}
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="date"
                  placeholder="Date de fin"
                  className="pl-10"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>

              {/* Nombre minimum de visiteurs */}
              <div className="relative">
                <Users className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="number"
                  placeholder="Min. visiteurs"
                  className="pl-10"
                  value={filters.minVisitors || ''}
                  onChange={(e) => setFilters({ ...filters, minVisitors: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button 
                onClick={handleSearch} 
                disabled={isLoading}
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
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default SearchSection;
