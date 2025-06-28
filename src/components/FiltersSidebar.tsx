import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { RegionSelect } from '@/components/ui/region-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useSearchParams } from 'react-router-dom';
import { useSectors } from '@/hooks/useSectors';
import { EVENT_TYPES } from '@/constants/eventTypes';
import { getRollingMonths } from '@/utils/monthUtils';
import type { SearchFilters } from '@/types/event';
import { supabase } from '@/integrations/supabase/client';

interface FiltersSidebarProps {
  onClose: () => void;
  onFiltersChange: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

export const FiltersSidebar = ({ onClose, onFiltersChange, initialFilters = {} }: FiltersSidebarProps) => {
  const [searchParams] = useSearchParams();
  const { data: sectorsData = [] } = useSectors();
  const [isInitialized, setIsInitialized] = useState(false);
  const [regions, setRegions] = useState<{ code: string; nom: string }[]>([]);
  
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

  // Load regions
  useEffect(() => {
    supabase
      .from('regions')
      .select('code, nom')
      .order('nom', { ascending: true })
      .then(({ data }) => data && setRegions(data));
  }, []);
  
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
  
  const [selectedRegion, setSelectedRegion] = useState(() => {
    // Initialize from URL params
    const locationTypeParam = searchParams.get('location_type');
    const locationValueParam = searchParams.get('location_value');
    
    if (locationTypeParam === 'region' && locationValueParam) {
      return locationValueParam;
    }
    
    return initialFilters.locationSuggestion?.value || '';
  });

  // Marquer comme initialisé après le premier rendu
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const handleRegionChange = (code: string) => {
    console.log('🎯 Sidebar - Région sélectionnée:', code);
    setSelectedRegion(code);
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
    
    // Handle region selection with locationSuggestion
    if (selectedRegion) {
      filters.locationSuggestion = {
        type: 'region',
        value: selectedRegion,
        label: regions.find(r => r.code === selectedRegion)?.nom || selectedRegion
      };
      console.log('🔍 Sidebar - Applying region filter:', selectedRegion);
    }
    
    console.log('FiltersSidebar: Applying filters after user interaction:', filters);
    onFiltersChange(filters);
  }, [sectorIds, types, months, selectedRegion, isInitialized, onFiltersChange, regions]);

  const clearAllFilters = () => {
    console.log('FiltersSidebar: Clearing all filters');
    setSectorIds([]);
    setTypes([]);
    setMonths([]);
    setSelectedRegion('');
  };

  const hasActiveFilters = sectorIds.length > 0 || types.length > 0 || months.length > 0 || selectedRegion;

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

        <RegionSelect
          regions={regions}
          value={selectedRegion}
          onValueChange={handleRegionChange}
          placeholder="Sélectionnez une région…"
          label="Région"
        />
      </div>
    </aside>
  );
};
