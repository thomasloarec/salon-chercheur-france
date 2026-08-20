import React from 'react';
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
import type { EventCategoryRow } from '@/hooks/useEventCategories';

const ICONS = [Hexagon, Layers, Shapes, Orbit, Component, Boxes, Squircle, Triangle, Sparkle, Circle];

/** Icône abstraite stable, dérivée du slug de la catégorie. */
function iconFor(slug: string) {
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
  className?: string;
}

export const EventCategoryCards: React.FC<Props> = ({ cards, activeKey, onSelect, className }) => (
  <div
    className={cn(
      'grid gap-3 sm:grid-cols-2',
      className,
    )}
    role="tablist"
    aria-label="Catégories d'exposants"
  >
    {cards.map((card) => {
      const Icon = iconFor(card.slug || card.key);
      const active = card.key === activeKey;
      return (
        <button
          key={card.key}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(card.key)}
          className={cn(
            'rounded-xl border bg-card p-4 text-left transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none',
            active
              ? 'border-primary bg-accent shadow-sm'
              : 'hover:border-primary/40 hover:bg-muted/40',
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-9 w-9 flex-none items-center justify-center rounded-lg',
                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  'heading-display text-sm leading-snug',
                  active ? 'font-semibold text-foreground' : 'font-medium text-foreground/90',
                )}
                title={card.label}
              >
                {card.label}
              </p>
              <p className="mt-0.5 text-xs font-medium text-primary">
                {card.count} exposant{card.count > 1 ? 's' : ''}
              </p>
              {card.examples.length > 0 && (
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                  {card.examples.slice(0, 3).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </button>
      );
    })}
  </div>
);

export default EventCategoryCards;
