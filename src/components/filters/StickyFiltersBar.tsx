import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SENTINEL_ALL, normalizeParam, isAll, updateUrlParam } from '@/lib/urlFilters';
import { SafeSelect } from '@/components/ui/SafeSelect';
import { fetchAllEventTypes, fetchAllRegions, ALL_MONTHS, type Option } from '@/lib/filtersData';
import { useDebounce } from '@/hooks/useDebounce';

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
  const currentQ = searchParams.get('q') ?? '';

  const [qInput, setQInput] = useState<string>(currentQ);
  const debouncedQ = useDebounce(qInput, 250);

  // Sync URL when debounced value changes
  useEffect(() => {
    const trimmed = debouncedQ.trim();
    const current = searchParams.get('q') ?? '';
    if (trimmed === current) return;
    const newParams = new URLSearchParams(searchParams);
    if (trimmed) newParams.set('q', trimmed);
    else newParams.delete('q');
    setSearchParams(newParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  // Sync from URL (e.g. back/forward navigation)
  useEffect(() => {
    if ((searchParams.get('q') ?? '') !== qInput) {
      setQInput(searchParams.get('q') ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('q')]);

  const hasActiveFilters =
    !isAll(currentType) ||
    !isAll(currentMonth) ||
    !isAll(currentRegion) ||
    (searchParams.get('sectors') ?? '').length > 0 ||
    qInput.trim().length > 0;

  const updateFilter = (key: string, value: string | null) => {
    const newParams = updateUrlParam(searchParams, key, value);
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('type');
    newParams.delete('month');
    newParams.delete('region');
    newParams.delete('sectors');
    newParams.delete('q');
    setSearchParams(newParams);
    setQInput('');
  };

  return (
    <div className={cn(
      "sticky top-16 z-30 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-b border-border",
      className
    )}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Rechercher un salon, une ville, un secteur…"
              aria-label="Rechercher un salon"
              className="h-[42px] pl-9 pr-9 rounded-full border-border bg-background focus-visible:ring-primary"
            />
            {qInput && (
              <button
                type="button"
                onClick={() => setQInput('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters group */}
          <div className="flex items-center gap-2 flex-wrap">
            <SafeSelect
              ariaLabel="Filtre mois"
              className="w-40 h-[42px] rounded-full"
              placeholder="Mois"
              value={isAll(currentMonth) ? null : currentMonth}
              onChange={(v) => updateFilter('month', v)}
              options={ALL_MONTHS}
              allLabel="Tous les mois"
            />
            <SafeSelect
              ariaLabel="Filtre type d'événement"
              className="w-40 h-[42px] rounded-full"
              placeholder="Type"
              value={isAll(currentType) ? null : currentType}
              onChange={(v) => updateFilter('type', v)}
              options={eventTypes}
              allLabel="Tous les types"
            />
            <SafeSelect
              ariaLabel="Filtre région"
              className="w-44 h-[42px] rounded-full"
              placeholder="Région"
              value={isAll(currentRegion) ? null : currentRegion}
              onChange={(v) => updateFilter('region', v)}
              options={regions}
              allLabel="Toutes les régions"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}