import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Building2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeStandNumber } from '@/utils/standUtils';

interface Exhibitor {
  id_exposant: string;
  exhibitor_name: string;
  stand_exposant?: string;
  website_exposant?: string;
  exposant_description?: string;
}

interface ExhibitorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitors: Exhibitor[];
  loading?: boolean;
  onSelect: (exhibitor: Exhibitor) => void;
}

const ALPHABET = ['All', '0-9', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];
const ITEMS_PER_PAGE = 50;

// Normalise le nom en supprimant espaces et caractères invisibles en début
const normalizeName = (name: string | null | undefined): string => {
  return (name ?? '').trim().replace(/^[\s\u00A0\u200B]+/, '');
};

export const ExhibitorsModal: React.FC<ExhibitorsModalProps> = ({ 
  open, 
  onOpenChange, 
  exhibitors = [],
  loading = false,
  onSelect 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Reset displayed count when filter changes
  useEffect(() => {
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [letterFilter, searchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setLetterFilter(null);
      setDisplayedCount(ITEMS_PER_PAGE);
    }
  }, [open]);

  const filtered = useMemo(() => {
    let result = [...exhibitors];
    
    // Tri alphabétique avec normalisation
    result.sort((a, b) => {
      const nameA = normalizeName(a.exhibitor_name);
      const nameB = normalizeName(b.exhibitor_name);
      return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
    });
    
    // Filtre par lettre avec normalisation
    if (letterFilter && letterFilter !== 'All') {
      if (letterFilter === '0-9') {
        result = result.filter((e) => {
          const firstChar = normalizeName(e.exhibitor_name).charAt(0);
          return /^[0-9]/.test(firstChar);
        });
      } else {
        result = result.filter((e) => {
          const firstChar = normalizeName(e.exhibitor_name).charAt(0).toUpperCase();
          return firstChar === letterFilter;
        });
      }
    }
    
    // Filtre par recherche texte
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((e) =>
        normalizeName(e.exhibitor_name).toLowerCase().includes(query) ||
        (e.stand_exposant ?? '').toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [searchQuery, letterFilter, exhibitors]);

  // Infinite scroll setup
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && displayedCount < filtered.length) {
      setDisplayedCount(prev => Math.min(prev + ITEMS_PER_PAGE, filtered.length));
    }
  }, [displayedCount, filtered.length]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  const displayedExhibitors = useMemo(() => {
    return filtered.slice(0, displayedCount);
  }, [filtered, displayedCount]);

  const hasMore = displayedCount < filtered.length;

  const handleLetterClick = (letter: string) => {
    if (letter === 'All') {
      setLetterFilter(null);
    } else if (letterFilter === letter) {
      setLetterFilter(null);
    } else {
      setLetterFilter(letter);
    }
  };

  const clearLetterFilter = () => {
    setLetterFilter(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Tous les exposants ({exhibitors.length})</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un exposant…" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>

          {/* Filtre alphabétique */}
          <div className="flex flex-wrap gap-1 justify-center">
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                onClick={() => handleLetterClick(letter)}
                className={cn(
                  "min-w-[28px] h-7 px-1.5 text-xs font-medium rounded transition-colors",
                  letterFilter === letter || (letter === 'All' && !letterFilter)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Indicateur de filtre actif */}
          {letterFilter && letterFilter !== 'All' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Filtre actif : {filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
              <Button
                variant="secondary"
                size="sm"
                className="h-6 px-2 gap-1"
                onClick={clearLetterFilter}
              >
                {letterFilter}
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Chargement...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[45vh] overflow-auto pr-1">
              {displayedExhibitors.map((ex) => (
                <button
                  key={ex.id_exposant}
                  className="text-left rounded-lg border p-3 hover:bg-accent transition-colors"
                  onClick={() => onSelect(ex)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{normalizeName(ex.exhibitor_name)}</div>
                      {ex.stand_exposant && (
                        <div className="text-xs text-muted-foreground">Stand {normalizeStandNumber(ex.stand_exposant)}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              
              {/* Sentinel pour infinite scroll */}
              {hasMore && (
                <div ref={loadMoreRef} className="col-span-full flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              
              {filtered.length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  {letterFilter ? `Aucun exposant commençant par "${letterFilter}"` : 'Aucun exposant trouvé'}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
