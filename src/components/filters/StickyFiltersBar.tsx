import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SENTINEL_ALL, normalizeParam, isAll, updateUrlParam } from '@/lib/urlFilters';
import { SafeSelect } from '@/components/ui/SafeSelect';

interface StickyFiltersBarProps {
  className?: string;
  defaultCollapsed?: boolean; // For novelties page
}

const SECTORS = [
  { id: 'agriculture', name: 'Agriculture' },
  { id: 'automobile', name: 'Automobile' },
  { id: 'construction', name: 'Construction' },
  { id: 'textile', name: 'Textile' },
  { id: 'alimentaire', name: 'Alimentaire' },
  { id: 'technologie', name: 'Technologie' },
];

const EVENT_TYPES = [
  { id: 'salon', name: 'Salon' },
  { id: 'conference', name: 'Conférence' },
  { id: 'exposition', name: 'Exposition' },
  { id: 'congres', name: 'Congrès' },
  { id: 'forum', name: 'Forum' },
];

const MONTHS = [
  { id: '01', name: 'Janvier' },
  { id: '02', name: 'Février' },
  { id: '03', name: 'Mars' },
  { id: '04', name: 'Avril' },
  { id: '05', name: 'Mai' },
  { id: '06', name: 'Juin' },
  { id: '07', name: 'Juillet' },
  { id: '08', name: 'Août' },
  { id: '09', name: 'Septembre' },
  { id: '10', name: 'Octobre' },
  { id: '11', name: 'Novembre' },
  { id: '12', name: 'Décembre' },
];

const REGIONS = [
  { id: '11', name: 'Île-de-France' },
  { id: '32', name: 'Hauts-de-France' },
  { id: '84', name: 'Auvergne-Rhône-Alpes' },
  { id: '76', name: 'Occitanie' },
  { id: '93', name: 'Provence-Alpes-Côte d\'Azur' },
  { id: '75', name: 'Nouvelle-Aquitaine' },
];

export default function StickyFiltersBar({ className, defaultCollapsed = false }: StickyFiltersBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const currentSector = normalizeParam(searchParams.get('sector'));
  const currentType = normalizeParam(searchParams.get('type'));
  const currentMonth = normalizeParam(searchParams.get('month'));
  const currentRegion = normalizeParam(searchParams.get('region'));

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

  const getSectorName = (id: string) => SECTORS.find(s => s.id === id)?.name || id;
  const getTypeName = (id: string) => EVENT_TYPES.find(t => t.id === id)?.name || id;
  const getMonthName = (id: string) => MONTHS.find(m => m.id === id)?.name || id;
  const getRegionName = (id: string) => REGIONS.find(r => r.id === id)?.name || id;

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
              options={SECTORS.map(sector => ({ value: String(sector.id), label: sector.name }))}
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
              options={EVENT_TYPES.map(type => ({ value: String(type.id), label: type.name }))}
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
              options={MONTHS.map(month => ({ value: String(month.id), label: month.name }))}
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
              options={REGIONS.map(region => ({ value: String(region.id), label: region.name }))}
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