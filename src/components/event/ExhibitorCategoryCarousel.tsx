import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatStandShort, normalizeStandNumber } from '@/utils/standUtils';
import ExhibitorAvatar from './ExhibitorAvatar';
import ExhibitorFullProfileCTA from '@/components/exhibitor/ExhibitorFullProfileCTA';
import {
  useCategoryExhibitors,
  CATEGORY_PAGE_SIZE,
  type CategoryExhibitorRow,
} from '@/hooks/useEventCategories';

interface Props {
  eventId: string;
  eventSlug?: string;
  /** Catégories servies par ce carousel (vide + includeUncategorized pour « Autres ») */
  categoryIds: string[];
  includeUncategorized: boolean;
  /** Titre dynamique, ex. « Exposants en Textile haut de gamme et broderie » */
  title: string;
  /** Icône de la catégorie active — signal de continuité avec l'onglet. */
  titleIcon?: React.ComponentType<{ className?: string }>;
  onSelect: (row: CategoryExhibitorRow) => void;
}


/**
 * Lot 6 — carousel horizontal d'exposants, alimenté par la RPC publique
 * get_public_event_exhibitors_by_category (un seul appel par page de 50).
 */
export const ExhibitorCategoryCarousel: React.FC<Props> = ({
  eventId,
  eventSlug,
  categoryIds,
  includeUncategorized,
  title,
  onSelect,
}) => {
  const key = useMemo(
    () => `${[...categoryIds].sort().join(',')}|${includeUncategorized}`,
    [categoryIds, includeUncategorized],
  );

  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<CategoryExhibitorRow[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Changement de catégorie : on repart de zéro, sans toucher au scroll de page.
  useEffect(() => {
    setOffset(0);
    setRows([]);
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
  }, [key]);

  const { data, isLoading, isError } = useCategoryExhibitors(
    eventId,
    categoryIds,
    includeUncategorized,
    offset,
  );

  useEffect(() => {
    if (!data) return;
    setRows((prev) => {
      if (offset === 0) return data.rows;
      const seen = new Set(prev.map((r) => r.id_exposant));
      return [...prev, ...data.rows.filter((r) => !seen.has(r.id_exposant))];
    });
  }, [data, offset]);

  const total = data?.total ?? 0;
  const hasMore = rows.length > 0 && rows.length < total;

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' });
  };

  const cardWidth =
    'w-[78%] xs:w-[70%] sm:w-[46%] md:w-[31%] lg:w-[31%] xl:w-[25%] flex-none';

  return (
    <div className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <h3 className="heading-display text-lg font-semibold text-foreground">
          {title}
          {total > 0 && <span className="ml-1.5 text-muted-foreground">({total})</span>}
        </h3>
        <div className="hidden gap-1.5 sm:flex">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Exposants précédents"
            onClick={() => scrollBy(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Exposants suivants"
            onClick={() => scrollBy(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {isLoading && rows.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn(cardWidth, 'rounded-xl border p-3')}>
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="mt-3 h-4 w-4/5" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            ))
          : rows.map((row) => (
              <div
                key={row.id_exposant}
                className={cn(
                  cardWidth,
                  'snap-start rounded-xl border bg-card transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  className="flex w-full flex-col items-start gap-3 p-3 text-left"
                >
                  <ExhibitorAvatar
                    name={row.display_name}
                    logoUrl={row.logo_url}
                    website={row.website}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0 w-full">
                    <div className="flex items-start gap-1">
                      <span className="line-clamp-2 text-sm font-medium text-foreground" title={row.display_name}>
                        {row.display_name}
                      </span>
                      {row.is_verified && (
                        <BadgeCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-primary" aria-label="Exposant vérifié" />
                      )}
                    </div>
                    {row.stand && (
                      <p
                        className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"
                        title={`Stand ${normalizeStandNumber(row.stand)}`}
                      >
                        <MapPin className="h-3 w-3 flex-none" />
                        <span className="truncate">Stand {formatStandShort(row.stand)}</span>
                      </p>
                    )}
                  </div>
                </button>
                {row.public_slug && (
                  <div className="px-3 pb-2.5">
                    <ExhibitorFullProfileCTA
                      publicSlug={row.public_slug}
                      seoIndexable={row.seo_indexable ?? true}
                      isTest={false}
                      openInNewTab
                      variant="link"
                      surface="event_exhibitor_list"
                      eventSlug={eventSlug}
                    />
                  </div>
                )}
              </div>
            ))}

        {hasMore && !isLoading && (
          <div className={cn(cardWidth, 'flex items-center justify-center')}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(rows.length - (rows.length % CATEGORY_PAGE_SIZE))}
            >
              Charger plus
            </Button>
          </div>
        )}
      </div>

      {isError && (
        <p className="text-sm text-muted-foreground">
          Impossible de charger les exposants de cette catégorie pour le moment.
        </p>
      )}
    </div>
  );
};

export default ExhibitorCategoryCarousel;
