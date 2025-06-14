import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { SearchFilters } from '@/types/event';

const sectorOptions = [
  { value: 'Technologie', label: 'Technologie & Innovation' },
  { value: 'Industrie', label: 'Industrie & Manufacturing' },
  { value: 'Santé', label: 'Santé & Médical' },
  { value: 'BTP', label: 'BTP & Construction' },
  { value: 'Commerce', label: 'Commerce & Distribution' },
  { value: 'Alimentation', label: 'Alimentation & Agriculture' },
  { value: 'Énergie', label: 'Énergie & Environnement' },
  { value: 'Services', label: 'Services B2B' },
];

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
  const [sectors, setSectors] = useState<string[]>(initialFilters.sectors || []);
  const [types, setTypes] = useState<string[]>(initialFilters.types || []);
  const [months, setMonths] = useState<string[]>(
    initialFilters.months?.map(m => m.toString()) || []
  );
  const [city, setCity] = useState(initialFilters.city || '');

  // Update local state when initialFilters change
  useEffect(() => {
    console.log('FiltersSidebar received initial filters:', initialFilters);
    setSectors(initialFilters.sectors || []);
    setTypes(initialFilters.types || []);
    setMonths(initialFilters.months?.map(m => m.toString()) || []);
    setCity(initialFilters.city || '');
  }, [initialFilters.sectors, initialFilters.types, initialFilters.months, initialFilters.city]);

  // Stabilize the filter application function
  const applyFilters = useCallback(() => {
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
    
    console.log('FiltersSidebar applying filters:', filters);
    onFiltersChange(filters);
  }, [sectors, types, months, city, onFiltersChange]);

  // Apply filters when any filter changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const clearAllFilters = () => {
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
