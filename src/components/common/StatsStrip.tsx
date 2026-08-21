import React from 'react';
import { cn } from '@/lib/utils';

export interface StatTile {
  key: string;
  value: string;
  label: string;
}

interface StatsStripProps {
  tiles: StatTile[];
  ariaLabel: string;
  className?: string;
  /** Nombre minimum de tuiles pour afficher la frise (défaut : 2). */
  minTiles?: number;
}

/**
 * Frise de statistiques partagée (lot 15).
 *
 * Style unique pour la page salon et la page exposant : pleine largeur du
 * conteneur, séparateurs verticaux fins, valeur en Playfair, libellé en
 * petites capitales espacées, bordure fine et aucune ombre.
 *
 * Le composant ne calcule rien : il reçoit des tuiles déjà filtrées. Une
 * statistique indisponible ne doit pas être passée (jamais de zéro ni de tiret).
 */
export const StatsStrip = ({ tiles, ariaLabel, className, minTiles = 2 }: StatsStripProps) => {
  if (tiles.length < minTiles) return null;

  const columns = tiles.length;

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'mx-auto w-full max-w-[1280px] rounded-xl border border-border bg-background px-4 py-4 sm:px-10 sm:py-6',
        className,
      )}
    >
      <div
        className={cn(
          'grid gap-y-4 gap-x-4 sm:[grid-template-columns:var(--stats-cols)]',
          columns === 1 ? 'grid-cols-1' : 'grid-cols-2',
        )}
        style={{ ['--stats-cols' as string]: `repeat(${columns}, minmax(0, 1fr))` } as React.CSSProperties}
      >
        {tiles.map((tile, index) => (
          <div
            key={tile.key}
            className={cn(
              'flex min-h-[64px] flex-col items-center justify-center gap-1 text-center',
              // 3 tuiles sur mobile : la dernière occupe toute la largeur.
              columns === 3 && index === 2 && 'col-span-2 sm:col-span-1',
              index > 0 && 'sm:border-l sm:border-border',
            )}
          >
            <span className="heading-display text-2xl leading-tight text-foreground tabular-nums sm:text-[32px]">
              {tile.value}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
              {tile.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default StatsStrip;
