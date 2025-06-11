
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, MapPin } from 'lucide-react';
import { useSectors } from '@/hooks/useEvents';
import { MultiSelect } from '@/components/ui/multi-select';
import { eachMonthOfInterval, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EVENT_TYPES } from '@/constants/eventTypes';
import { useSearchParam } from '@/hooks/useSearchParams';

interface FiltersSidebarProps {
  onClose?: () => void;
  onFiltersChange: (filters: any) => void;
}

export const FiltersSidebar = ({ onClose, onFiltersChange }: FiltersSidebarProps) => {
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [city, setCity] = useState('');
  
  const { data: sectors } = useSectors();

  // Generate months list (remaining months of current year + next year)
  const months = eachMonthOfInterval({
    start: new Date(),
    end: new Date(new Date().getFullYear() + 1, 11, 31)
  }).map(date => ({
    value: (date.getMonth() + 1).toString(),
    label: format(date, 'MMMM yyyy', { locale: fr })
  }));

  const sectorOptions = sectors?.map(sector => ({
    value: sector.name,
    label: sector.name
  })) || [];

  const handleApplyFilters = () => {
    onFiltersChange({
      sectors: selectedSectors,
      types: selectedTypes,
      months: selectedMonths.map(m => parseInt(m)),
      city: city || undefined,
    });
  };

  const handleReset = () => {
    setSelectedSectors([]);
    setSelectedTypes([]);
    setSelectedMonths([]);
    setCity('');
    onFiltersChange({});
  };

  useEffect(() => {
    handleApplyFilters();
  }, [selectedSectors, selectedTypes, selectedMonths, city]);

  return (
    <div className="h-full bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Filtres</h2>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-6">
          {/* Secteurs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Secteurs d'activité</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={sectorOptions}
                selected={selectedSectors}
                onChange={setSelectedSectors}
                placeholder="Tous les secteurs"
              />
            </CardContent>
          </Card>

          {/* Types d'événement */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Type d'événement</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={EVENT_TYPES}
                selected={selectedTypes}
                onChange={setSelectedTypes}
                placeholder="Tous les types"
              />
            </CardContent>
          </Card>

          {/* Ville */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ville / Région</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Ville ou région"
                  className="pl-10"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Mois */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Période</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={months}
                selected={selectedMonths}
                onChange={setSelectedMonths}
                placeholder="Tous les mois"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              className="flex-1"
            >
              Réinitialiser
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
