import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SENTINEL_ALL, normalizeParam, isAll, updateUrlParam } from '@/lib/urlFilters';

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
            <Select value={currentSector} onValueChange={(value) => updateFilter('sector', value)}>
              <SelectTrigger className="w-40" aria-label="Filtre secteur">
                <SelectValue placeholder="Secteur d'activité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_ALL}>Tous les secteurs</SelectItem>
                {SECTORS.filter(sector => sector && sector.id && String(sector.id).trim() !== '')
                  .map((sector) => (
                    <SelectItem key={sector.id} value={String(sector.id)}>
                      {sector.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Type
            </label>
            <Select value={currentType} onValueChange={(value) => updateFilter('type', value)}>
              <SelectTrigger className="w-40" aria-label="Filtre type d'événement">
                <SelectValue placeholder="Type d'événement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_ALL}>Tous les types</SelectItem>
                {EVENT_TYPES.filter(type => type && type.id && String(type.id).trim() !== '')
                  .map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Mois
            </label>
            <Select value={currentMonth} onValueChange={(value) => updateFilter('month', value)}>
              <SelectTrigger className="w-40" aria-label="Filtre mois">
                <SelectValue placeholder="Mois" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_ALL}>Tous les mois</SelectItem>
                {MONTHS.filter(month => month && month.id && String(month.id).trim() !== '')
                  .map((month) => (
                    <SelectItem key={month.id} value={String(month.id)}>
                      {month.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Region Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Région
            </label>
            <Select value={currentRegion} onValueChange={(value) => updateFilter('region', value)}>
              <SelectTrigger className="w-40" aria-label="Filtre région">
                <SelectValue placeholder="Région" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_ALL}>Toutes les régions</SelectItem>
                {REGIONS.filter(region => region && region.id && String(region.id).trim() !== '')
                  .map((region) => (
                    <SelectItem key={region.id} value={String(region.id)}>
                      {region.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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