import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Circle,
  Component,
  Hexagon,
  Layers,
  LayoutGrid,
  Orbit,
  Shapes,
  Sparkle,
  Squircle,
  Triangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = [Hexagon, Layers, Shapes, Orbit, Component, Boxes, Squircle, Triangle, Sparkle, Circle];

/** Icône abstraite stable, dérivée du slug de la catégorie. */
export function iconFor(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) % 9973;
  return ICONS[hash % ICONS.length];
}

/** Lot 14 — ombre douce partagée entre la carte active et le panneau. */
export const PANEL_SHADOW = '0 1px 2px rgba(11, 19, 43, 0.06), 0 8px 24px rgba(11, 19, 43, 0.07)';

export interface CategoryCardModel {
  /** Identifiant local : uuid de catégorie, ou 'others' pour le bucket */
  key: string;
  label: string;
  slug: string;
  count: number;
  examples: string[];
}

interface Props {
  cards: CategoryCardModel[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  /** id du tabpanel piloté par cette rangée d'onglets */
  panelId: string;
  /** Lot 14 — « Voir toutes les catégories » rattaché à la rangée */
  onShowAll?: () => void;
  showAllCount?: number;
  className?: string;
}

/**
 * Lot 13 — système d'onglets défilable (scroll-snap, tablist, clavier).
 * Lot 14 — plus aucun exemple d'entreprise, dégradés + flèches conditionnés
 * à la position de défilement, continuité par le fond (aucune bordure violette).
 */
export const EventCategoryCards: React.FC<Props> = ({
  cards,
  activeKey,
  onSelect,
  panelId,
  onShowAll,
  showAllCount,
  className,
}) => {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateEdges, cards.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const focusAt = (index: number) => {
    const target = cards[(index + cards.length) % cards.length];
    if (!target) return;
    onSelect(target.key);
    const el = refs.current[target.key];
    el?.focus();
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  };

  return (
    <div className={cn('relative', className)}>
      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="flex snap-x gap-2.5 overflow-x-auto scroll-p-6 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Catégories d'exposants"
      >
        {cards.map((card, index) => {
          const Icon = iconFor(card.slug || card.key);
          const active = card.key === activeKey;
          return (
            <button
              key={card.key}
              ref={(el) => {
                refs.current[card.key] = el;
              }}
              type="button"
              role="tab"
              id={`cat-tab-${card.key}`}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  focusAt(index + 1);
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  focusAt(index - 1);
                }
              }}
              onClick={() => onSelect(card.key)}
              style={active ? { boxShadow: PANEL_SHADOW } : undefined}
              className={cn(
                'relative w-[13rem] flex-none snap-start overflow-hidden rounded-t-xl px-3.5 py-3 text-left transition-[background-color,box-shadow,border-color] duration-200 motion-reduce:transition-none',
                active
                  ? 'z-10 border-0 bg-card'
                  : 'rounded-b-xl border border-border bg-card hover:bg-muted/40',
              )}
            >
              {/* Marqueur d'onglet : trait violet en bord supérieur */}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[3px] rounded-full bg-primary"
                />
              )}
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-8 w-8 flex-none items-center justify-center rounded-lg',
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'heading-display line-clamp-2 text-sm leading-snug',
                      active ? 'font-semibold text-foreground' : 'font-medium text-foreground/90',
                    )}
                    title={card.label}
                  >
                    {card.label}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-primary">
                    {card.count} exposant{card.count > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </button>
          );
        })}

        {/* Lot 14 — « Voir toutes les catégories » en fin de rangée */}
        {onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            className="flex w-[11rem] flex-none snap-start items-center gap-2 self-stretch rounded-xl border border-dashed border-border bg-transparent px-3.5 py-3 text-left text-sm font-medium text-primary transition-colors duration-200 hover:bg-muted/40 motion-reduce:transition-none"
          >
            <LayoutGrid className="h-4 w-4 flex-none" />
            <span className="leading-snug">
              Voir toutes les catégories{typeof showAllCount === 'number' ? ` (${showAllCount})` : ''}
            </span>
          </button>
        )}
      </div>

      {/* Dégradés de bord, conditionnés à la position de défilement */}
      {canLeft && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#F7F8FA] to-transparent"
        />
      )}
      {canRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#F7F8FA] to-transparent"
        />
      )}

      {canLeft && (
        <button
          type="button"
          aria-label="Catégories précédentes"
          onClick={() => scrollBy(-1)}
          className="absolute left-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted sm:flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Catégories suivantes"
          onClick={() => scrollBy(1)}
          className="absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted sm:flex"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default EventCategoryCards;
