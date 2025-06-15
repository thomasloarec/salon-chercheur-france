
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useSearchParams } from 'react-router-dom';
import { useSectors } from '@/hooks/useSectors';
import type { SearchFilters } from '@/types/event';

const typeOptions = [
  { value: 'salon', label: 'Salon' },
  { value: 'convention', label: 'Convention' },
  { value: 'congres', label: 'Congrès' },
  { value: 'conference', label: 'Conférence' },
];

const monthOptions = [
  { value: '1', label: 'Janvier' },
  { value: '2', label: 'Février' },
  { value: '3', label: 'Mars' },
  { value: '4', label: 'Avril' },
  { value: '5', label: 'Mai' },
  { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' },
  { value: '8', label: 'Août' },
  { value: '9', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' },
];

interface FiltersSidebarProps {
  onClose: () => void;
  onFiltersChange: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

export const FiltersSidebar = ({ onClose, onFiltersChange, initialFilters = {} }: FiltersSidebarProps) => {
  const [searchParams] = useSearchParams();
  const { data: sectorsData = [] } = useSectors();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Créer les options des secteurs à partir des données de l'API
  const sectorOptions = sectorsData.map(sector => ({
    value: sector.name,
    label: sector.name,
  }));
  
  // Initialisation une seule fois au montage avec les paramètres URL
  const [sectors, setSectors] = useState<string[]>(() => {
    const sectorsParam = searchParams.get('sectors');
    return sectorsParam ? sectorsParam.split(',') : (initialFilters.sectors || []);
  });
  
  const [types, setTypes] = useState<string[]>(() => {
    const typesParam = searchParams.get('types');
    return typesParam ? typesParam.split(',') : (initialFilters.types || []);
  });
  
  const [months, setMonths] = useState<string[]>(() => {
    const monthsParam = searchParams.get('months');
    return monthsParam ? monthsParam.split(',') : (initialFilters.months?.map(m => m.toString()) || []);
  });
  
  const [city, setCity] = useState(() => {
    return searchParams.get('city') || initialFilters.city || '';
  });

  // Marquer comme initialisé après le premier rendu
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Application des filtres uniquement après initialisation et quand les valeurs changent
  useEffect(() => {
    if (!isInitialized) return;

    const filters: SearchFilters = {};
    
    if (sectors.length > 0) {
      filters.sectors = sectors;
    }
    
    if (types.length > 0) {
      filters.types = types;
    }
    
    if (months.length > 0) {
      filters.months = months.map(m => parseInt(m));
    }
    
    if (city.trim()) {
      filters.city = city.trim();
    }
    
    console.log('FiltersSidebar: Applying filters after user interaction:', filters);
    onFiltersChange(filters);
  }, [sectors, types, months, city, isInitialized, onFiltersChange]);

  const clearAllFilters = () => {
    console.log('FiltersSidebar: Clearing all filters');
    setSectors([]);
    setTypes([]);
    setMonths([]);
    setCity('');
  };

  const hasActiveFilters = sectors.length > 0 || types.length > 0 || months.length > 0 || city.trim();

  return (
    <div className="h-full bg-white border-r overflow-y-auto">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filtres</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAllFilters}
            className="mt-2 w-full"
          >
            Réinitialiser
          </Button>
        )}
      </div>

      <div className="p-4 space-y-6">
        <div>
          <Label htmlFor="sectors">Secteurs d'activité</Label>
          <MultiSelect
            options={sectorOptions}
            selected={sectors}
            onChange={setSectors}
            placeholder="Sélectionner des secteurs..."
          />
        </div>

        <Separator />

        <div>
          <Label htmlFor="types">Type d'événement</Label>
          <MultiSelect
            options={typeOptions}
            selected={types}
            onChange={setTypes}
            placeholder="Sélectionner des types..."
          />
        </div>

        <Separator />

        <div>
          <Label htmlFor="months">Mois</Label>
          <MultiSelect
            options={monthOptions}
            selected={months}
            onChange={setMonths}
            placeholder="Sélectionner des mois..."
          />
        </div>

        <Separator />

        <div>
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            type="text"
            placeholder="Entrez une ville..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
