
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

  // Créer les options des régions
  const regionOptions = regions.map(region => ({
    value: region.code,
    label: region.nom,
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
  
  const [selectedRegion, setSelectedRegion] = useState<string[]>(() => {
    // Initialize from URL params
    const locationTypeParam = searchParams.get('location_type');
    const locationValueParam = searchParams.get('location_value');
    
    if (locationTypeParam === 'region' && locationValueParam) {
      return [locationValueParam];
    }
    
    return initialFilters.locationSuggestion?.value ? [initialFilters.locationSuggestion.value] : [];
  });

  // Marquer comme initialisé après le premier rendu
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const handleRegionChange = (codes: string[]) => {
    console.log('🎯 Sidebar - Région sélectionnée:', codes[0] || '');
    setSelectedRegion(codes);
  };

  const handleSectorChange = (newSectorIds: string[]) => {
    console.log('🎯 Sidebar - Secteurs sélectionnés (IDs):', newSectorIds);
    
    // Log des noms des secteurs pour debug
    const selectedSectorNames = newSectorIds.map(id => {
      const sector = sectorsData.find(s => s.id === id);
      return sector ? sector.name : id;
    });
    console.log('🏷️ Sidebar - Secteurs sélectionnés (noms):', selectedSectorNames);
    
    setSectorIds(newSectorIds);
  };

  // Application des filtres uniquement après initialisation et quand les valeurs changent
  useEffect(() => {
    if (!isInitialized) return;

    const filters: SearchFilters = {};
    
    if (sectorIds.length > 0) {
      filters.sectorIds = sectorIds;
      console.log('🔍 Sidebar - Application filtres secteurs (IDs):', sectorIds);
    }
    
    if (types.length > 0) {
      filters.types = types;
    }
    
    if (months.length > 0) {
      // Convert month strings back to numbers for compatibility
      filters.months = months.map(m => parseInt(m.split('-')[0]));
    }
    
    // Handle region selection with locationSuggestion
    if (selectedRegion.length > 0) {
      const regionCode = selectedRegion[0];
      filters.locationSuggestion = {
        type: 'region',
        value: regionCode,
        label: regions.find(r => r.code === regionCode)?.nom || regionCode
      };
      console.log('🔍 Sidebar - Applying region filter:', regionCode);
    }
    
    console.log('🎯 FiltersSidebar - Filtres finaux appliqués:', filters);
    onFiltersChange(filters);
  }, [sectorIds, types, months, selectedRegion, isInitialized, onFiltersChange, regions, sectorsData]);

  const clearAllFilters = () => {
    console.log('FiltersSidebar: Clearing all filters');
    setSectorIds([]);
    setTypes([]);
    setMonths([]);
    setSelectedRegion([]);
  };

  const hasActiveFilters = sectorIds.length > 0 || types.length > 0 || months.length > 0 || selectedRegion.length > 0;

  return (
    <aside className="sticky top-[80px] self-start max-h-[calc(100vh-80px)] overflow-y-auto h-full bg-white">(Reminder: You only invoked a single tool call. Remember that for the sake of efficiency, you should try to parallelize tool calls whenever possible.)
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Filtres</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="lg:hidden">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAllFilters}
            className="mt-3 w-full"
          >
            Réinitialiser
          </Button>
        )}
      </div>

      <div className="p-6 space-y-8">
        <div>
          <Label htmlFor="sectors">Secteurs d'activité</Label>
          <MultiSelect
            options={sectorOptions}
            selected={sectorIds}
            onChange={handleSectorChange}
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
          <Label htmlFor="regions">Région</Label>
          <MultiSelect
            options={regionOptions}
            selected={selectedRegion}
            onChange={handleRegionChange}
            placeholder="Sélectionner une région..."
          />
        </div>
      </div>
    </aside>
  );
};
