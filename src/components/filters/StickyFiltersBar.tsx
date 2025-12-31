import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SENTINEL_ALL, normalizeParam, isAll, updateUrlParam } from '@/lib/urlFilters';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { fetchAllEventTypes, fetchAllRegions, ALL_MONTHS, type Option } from '@/lib/filtersData';

interface StickyFiltersBarProps {
  className?: string;
}


export default function StickyFiltersBar({ className }: StickyFiltersBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State for filter options
  const [eventTypes, setEventTypes] = useState<Option[]>([]);
  const [regions, setRegions] = useState<Option[]>([]);
  
  // Load filter options on component mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [eventTypesData, regionsData] = await Promise.all([
          fetchAllEventTypes(),
          fetchAllRegions(),
        ]);
        
        setEventTypes(eventTypesData);
        setRegions(regionsData);
      } catch (error) {
        console.warn('[StickyFiltersBar] Error loading filter options:', error);
      }
    };
    
    loadOptions();
  }, []);

  const currentType = normalizeParam(searchParams.get('type'));
  const currentMonth = normalizeParam(searchParams.get('month'));
  const currentRegion = normalizeParam(searchParams.get('region'));

  const hasActiveFilters = !isAll(currentType) || !isAll(currentMonth) || !isAll(currentRegion);

  const updateFilter = (key: string, value: string | null) => {
    const newParams = updateUrlParam(searchParams, key, value);
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('type');
    newParams.delete('month');
    newParams.delete('region');
    setSearchParams(newParams);
  };

  const getTypeName = (id: string) => eventTypes.find(t => t.value === id)?.label || id;
  const getMonthName = (id: string) => ALL_MONTHS.find(m => m.value === id)?.label || id;
  const getRegionName = (id: string) => regions.find(r => r.value === id)?.label || id;

  return (
    <div className={cn(
      "sticky top-16 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
      className
    )}>
      <div className="container mx-auto px-4 py-3">
        {/* Filters - Horizontal scroll on mobile */}
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar md:overflow-visible md:flex-wrap">
          
          {/* Type Filter */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Type
            </label>
            <SafeSelect
              ariaLabel="Filtre type d'événement"
              className="w-40"
              placeholder="Type d'événement"
              value={isAll(currentType) ? null : currentType}
              onChange={(v) => updateFilter('type', v)}
              options={eventTypes}
              allLabel="Tous les types"
            />
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Mois
            </label>
            <SafeSelect
              ariaLabel="Filtre mois"
              className="w-40"
              placeholder="Mois"
              value={isAll(currentMonth) ? null : currentMonth}
              onChange={(v) => updateFilter('month', v)}
              options={ALL_MONTHS}
              allLabel="Tous les mois"
            />
          </div>

          {/* Region Filter */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Région
            </label>
            <SafeSelect
              ariaLabel="Filtre région"
              className="w-40"
              placeholder="Région"
              value={isAll(currentRegion) ? null : currentRegion}
              onChange={(v) => updateFilter('region', v)}
              options={regions}
              allLabel="Toutes les régions"
            />
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex flex-wrap gap-1">
                {!isAll(currentType) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getTypeName(currentType)}
                    <button
                      onClick={() => updateFilter('type', SENTINEL_ALL)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                      aria-label="Supprimer le filtre type"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {!isAll(currentMonth) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getMonthName(currentMonth)}
                    <button
                      onClick={() => updateFilter('month', SENTINEL_ALL)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                      aria-label="Supprimer le filtre mois"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {!isAll(currentRegion) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getRegionName(currentRegion)}
                    <button
                      onClick={() => updateFilter('region', SENTINEL_ALL)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                      aria-label="Supprimer le filtre région"
                    >
                      ×
                    </button>
                  </Badge>
                )}
              </div>
              
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Effacer tout
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}