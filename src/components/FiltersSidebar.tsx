
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useSearchParams } from 'react-router-dom';
import { useSectors } from '@/hooks/useSectors';
import { EVENT_TYPES } from '@/constants/eventTypes';
import { getRollingMonths } from '@/utils/monthUtils';
import LocationAutocomplete, { type LocationSuggestion } from './LocationAutocomplete';
import type { SearchFilters } from '@/types/event';

interface FiltersSidebarProps {
  onClose: () => void;
  onFiltersChange: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

export const FiltersSidebar = ({ onClose, onFiltersChange, initialFilters = {} }: FiltersSidebarProps) => {
  const [searchParams] = useSearchParams();
  const { data: sectorsData = [] } = useSectors();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Créer les options des secteurs avec IDs comme valeurs
  const sectorOptions = sectorsData.map(sector => ({
    value: sector.id,
    label: sector.name,
  }));

  // Créer les options de mois glissants
  const monthOptions = getRollingMonths().map(monthOption => ({
    value: `${monthOption.month}-${monthOption.year}`,
    label: monthOption.label,
  }));
  
  // Initialisation une seule fois au montage avec les paramètres URL
  const [sectorIds, setSectorIds] = useState<string[]>(() => {
    const sectorsParam = searchParams.get('sectors');
    return sectorsParam ? sectorsParam.split(',') : (initialFilters.sectorIds || []);
  });
  
  const [types, setTypes] = useState<string[]>(() => {
    const typesParam = searchParams.get('types');
    return typesParam ? typesParam.split(',') : (initialFilters.types || []);
  });
  
  const [months, setMonths] = useState<string[]>(() => {
    const monthsParam = searchParams.get('months');
    return monthsParam ? monthsParam.split(',') : (initialFilters.months?.map(m => m.toString()) || []);
  });
  
  const [locationQuery, setLocationQuery] = useState(() => {
    // Initialize from URL params or initial filters
    const locationTypeParam = searchParams.get('location_type');
    const locationValueParam = searchParams.get('location_value');
    
    if (locationTypeParam && locationValueParam) {
      return locationValueParam;
    }
    
    return initialFilters.locationSuggestion?.label || '';
  });

  const [selectedLocationSuggestion, setSelectedLocationSuggestion] = useState<LocationSuggestion | null>(() => {
    // Initialize from URL params
    const locationTypeParam = searchParams.get('location_type');
    const locationValueParam = searchParams.get('location_value');
    
    if (locationTypeParam && locationValueParam) {
      return {
        type: locationTypeParam as LocationSuggestion['type'],
        value: locationValueParam,
        label: locationValueParam
      };
    }
    
    return initialFilters.locationSuggestion || null;
  });

  // Marquer comme initialisé après le premier rendu
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const handleLocationSelect = (suggestion: LocationSuggestion) => {
    console.log('🎯 Sidebar - Location selected:', suggestion);
    setSelectedLocationSuggestion(suggestion);
    setLocationQuery(suggestion.label);
  };

  const handleLocationChange = (value: string) => {
    setLocationQuery(value);
    // Reset suggestion if user changes the text
    if (selectedLocationSuggestion && value !== selectedLocationSuggestion.label) {
      setSelectedLocationSuggestion(null);
    }
  };

  // Application des filtres uniquement après initialisation et quand les valeurs changent
  useEffect(() => {
    if (!isInitialized) return;

    const filters: SearchFilters = {};
    
    if (sectorIds.length > 0) {
      filters.sectorIds = sectorIds;
    }
    
    if (types.length > 0) {
      filters.types = types;
    }
    
    if (months.length > 0) {
      // Convert month strings back to numbers for compatibility
      filters.months = months.map(m => parseInt(m.split('-')[0]));
    }
    
    // Handle location with locationSuggestion
    if (selectedLocationSuggestion) {
      filters.locationSuggestion = selectedLocationSuggestion;
      console.log('🔍 Sidebar - Applying location suggestion:', selectedLocationSuggestion);
    } else if (locationQuery.trim()) {
      // Fallback to text search
      filters.locationSuggestion = {
        type: 'text',
        value: locationQuery.trim(),
        label: locationQuery.trim()
      };
      console.log('🔍 Sidebar - Applying text location:', locationQuery.trim());
    }
    
    console.log('FiltersSidebar: Applying filters after user interaction:', filters);
    onFiltersChange(filters);
  }, [sectorIds, types, months, selectedLocationSuggestion, locationQuery, isInitialized, onFiltersChange]);

  const clearAllFilters = () => {
    console.log('FiltersSidebar: Clearing all filters');
    setSectorIds([]);
    setTypes([]);
    setMonths([]);
    setLocationQuery('');
    setSelectedLocationSuggestion(null);
  };

  const hasActiveFilters = sectorIds.length > 0 || types.length > 0 || months.length > 0 || selectedLocationSuggestion || locationQuery.trim();

  return (
    <aside className="sticky top-0 max-h-screen overflow-y-auto h-full bg-white border-r">
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
            selected={sectorIds}
            onChange={setSectorIds}
            placeholder="Sélectionner des secteurs..."
          />
        </div>

        <Separator />

        <div>
          <Label htmlFor="types">Type d'événement</Label>
          <MultiSelect
            options={EVENT_TYPES}
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
          <Label htmlFor="location">Localisation</Label>
          <LocationAutocomplete
            value={locationQuery}
            onChange={handleLocationChange}
            onSelect={handleLocationSelect}
            placeholder="Ville, département, région..."
          />
        </div>
      </div>
    </aside>
  );
};
