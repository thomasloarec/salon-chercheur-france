import React, { useRef } from 'react';
import {
  Boxes,
  Circle,
  Component,
  Hexagon,
  Layers,
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
  className?: string;
}

/**
 * Lot 13 — la navigation par catégories devient un vrai système d'onglets :
 * une seule rangée défilable (scroll-snap), sémantique tablist/tab,
 * navigation clavier par flèches, et ergot de continuité vers le panneau.
 */
export const EventCategoryCards: React.FC<Props> = ({
  cards,
  activeKey,
  onSelect,
  panelId,
  className,
}) => {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const focusAt = (index: number) => {
    const target = cards[(index + cards.length) % cards.length];
    if (!target) return;
    onSelect(target.key);
    const el = refs.current[target.key];
    el?.focus();
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  };

  return (
    <div
      className={cn(
        'flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
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
            className={cn(
              'relative flex-none snap-start rounded-t-xl border px-3.5 py-3 text-left transition-[background-color,border-color,color] duration-200 motion-reduce:transition-none',
              active
                ? 'z-10 -mb-px w-[16rem] border-primary/40 border-b-transparent bg-violet-soft/60'
                : 'w-[13rem] rounded-b-xl border-border bg-card hover:border-primary/30 hover:bg-muted/40',
            )}
          >
            <div className="flex items-start gap-2.5">
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
                {/* Lot 13 — les exemples n'apparaissent que sur la carte active. */}
                {active && card.examples.length > 0 && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {card.examples.slice(0, 3).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {/* Ergot de continuité vers le panneau */}
            {active && (
              <span
                aria-hidden="true"
                className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-primary/40 bg-violet-soft/60"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default EventCategoryCards;
