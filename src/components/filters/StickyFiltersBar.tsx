import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SENTINEL_ALL, normalizeParam, isAll, updateUrlParam } from '@/lib/urlFilters';
import { normalizeSectorSlug } from '@/lib/taxonomy';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { fetchAllSectorsPreferCanonical, fetchAllEventTypes, fetchAllRegions, ALL_MONTHS, type Option } from '@/lib/filtersData';

interface StickyFiltersBarProps {
  className?: string;
  defaultCollapsed?: boolean; // For novelties page
}


export default function StickyFiltersBar({ className, defaultCollapsed = false }: StickyFiltersBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  
  // State for filter options
  const [sectors, setSectors] = useState<Option[]>([]);
  const [eventTypes, setEventTypes] = useState<Option[]>([]);
  const [regions, setRegions] = useState<Option[]>([]);
  
  // Load filter options on component mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [sectorsData, eventTypesData, regionsData] = await Promise.all([
          fetchAllSectorsPreferCanonical(),
          fetchAllEventTypes(),
          fetchAllRegions(),
        ]);
        
        setSectors(sectorsData);
        setEventTypes(eventTypesData);
        setRegions(regionsData);
      } catch (error) {
        console.warn('[StickyFiltersBar] Error loading filter options:', error);
      }
    };
    
    loadOptions();
  }, []);

  const currentSectorRaw = normalizeParam(searchParams.get('sector'));
  const currentSector = normalizeSectorSlug(currentSectorRaw) || SENTINEL_ALL;
  const currentType = normalizeParam(searchParams.get('type'));
  const currentMonth = normalizeParam(searchParams.get('month'));
  const currentRegion = normalizeParam(searchParams.get('region'));

  // Clean URL if old sector alias detected
  React.useEffect(() => {
    if (currentSectorRaw !== SENTINEL_ALL && currentSectorRaw !== currentSector) {
      updateFilter('sector', currentSector === SENTINEL_ALL ? null : currentSector);
    }
  }, [currentSectorRaw, currentSector]);

  const hasActiveFilters = !isAll(currentSector) || !isAll(currentType) || !isAll(currentMonth) || !isAll(currentRegion);
  const activeFilterCount = [currentSector, currentType, currentMonth, currentRegion].filter(v => !isAll(v)).length;

  const updateFilter = (key: string, value: string | null) => {
    const newParams = updateUrlParam(searchParams, key, value);
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams();
    setSearchParams(newParams);
  };

  const getSectorName = (id: string) => sectors.find(s => s.value === id)?.label || id;
  const getTypeName = (id: string) => eventTypes.find(t => t.value === id)?.label || id;
  const getMonthName = (id: string) => ALL_MONTHS.find(m => m.value === id)?.label || id;
  const getRegionName = (id: string) => regions.find(r => r.value === id)?.label || id;

  return (
    <div className={cn(
      "sticky top-16 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
      className
    )}>
      <div className="container mx-auto px-4 py-3">
        {/* Toggle button for collapsible mode */}
        {defaultCollapsed && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={cn("h-4 w-4 transition-transform", !isCollapsed && "rotate-180")} />
            </Button>
            
            {hasActiveFilters && !isCollapsed && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Effacer tout
              </Button>
            )}
          </div>
        )}

        {/* Filters */}
        <div className={cn(
          "flex flex-wrap items-center gap-4",
          defaultCollapsed && isCollapsed && "hidden",
          defaultCollapsed && !isCollapsed && "mt-3 pt-3 border-t"
        )}>
          {/* Sector Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Secteur
            </label>
            <SafeSelect
              ariaLabel="Filtre secteur"
              className="w-40"
              placeholder="Secteur d'activité"
              value={isAll(currentSector) ? null : currentSector}
              onChange={(v) => updateFilter('sector', v)}
              options={sectors}
              allLabel="Tous les secteurs"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
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
                {!isAll(currentSector) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getSectorName(currentSector)}
                    <button
                      onClick={() => updateFilter('sector', SENTINEL_ALL)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {!isAll(currentType) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getTypeName(currentType)}
                    <button
                      onClick={() => updateFilter('type', SENTINEL_ALL)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
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
                    >
                      ×
                    </button>
                  </Badge>
                )}
              </div>
              
              {!defaultCollapsed && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Effacer tout
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}