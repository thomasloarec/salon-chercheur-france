import React from 'react';
import { cn } from '@/lib/utils';

export type BandTone = 'light-texture' | 'white' | 'dark-texture' | 'dark-photo' | 'soft';
export type BandSpace = 'sm' | 'md' | 'lg' | 'none';

/**
 * Lot 11 — bande horizontale pleine largeur.
 *
 * Une section n'est plus une carte : elle est une bande de fond allant d'un
 * bord à l'autre de la fenêtre, dont le contenu reste contenu à 1280 px.
 *
 * Textures réutilisées telles quelles depuis l'existant :
 *  - claire  : /backgrounds/recherche-ia-bg.jpg (page Recherche IA)
 *  - sombre  : /home-texture-plexus.jpg (page d'accueil, section « problème »)
 */
const SPACE: Record<BandSpace, string> = {
  none: '',
  // Lot 13 — aucun padding de bande ne dépasse 56 px (py-14) sur desktop.
  sm: 'py-6 md:py-8 lg:py-10',
  md: 'py-8 md:py-10 lg:py-14',
  lg: 'py-10 md:py-12 lg:py-14',
};


interface EventBandProps {
  tone?: BandTone;
  space?: BandSpace;
  id?: string;
  className?: string;
  /** Classe appliquée au conteneur interne (max-width + gouttières). */
  innerClassName?: string;
  children: React.ReactNode;
}

export const EventBand: React.FC<EventBandProps> = ({
  tone = 'white',
  space = 'md',
  id,
  className,
  innerClassName,
  children,
}) => {
  const isDark = tone === 'dark-texture' || tone === 'dark-photo';

  return (
    <section
      id={id}
      className={cn(
        'relative w-full',
        tone === 'white' && 'bg-background',
        tone === 'soft' && 'bg-muted/40',
        tone === 'light-texture' && 'bg-background',
        isDark && 'bg-surface-inverse text-inverse',
        SPACE[space],
        className,
      )}
    >
      {tone === 'light-texture' && (
        <>
          {/* Lot 13 — texture volontairement discrète (35 %) : elle donne de la
              matière sans jamais entamer le contraste du texte. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.35]"
            style={{ backgroundImage: "url('/backgrounds/recherche-ia-bg.jpg')" }}
          />
          {/* Voile blanc derrière la colonne de texte, estompé vers la droite
              pour laisser la texture respirer côté image. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, hsl(var(--background) / 0.88) 0%, hsl(var(--background) / 0.7) 45%, hsl(var(--background) / 0) 80%)',
            }}
          />
          {/* Fondu bas uniquement : raccord propre sur la bande blanche suivante. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                'linear-gradient(180deg, hsl(var(--background) / 0), hsl(var(--background)))',
            }}
          />
        </>
      )}



      {tone === 'dark-texture' && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.28]"
            style={{ backgroundImage: 'url(/home-texture-plexus.jpg)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(80% 60% at 50% 40%, transparent, hsl(var(--surface-inverse) / 0.85))',
            }}
          />
        </>
      )}

      {tone === 'dark-photo' && (
        <>
          {/* Illustration salons, identique au hero de /salons. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/salons-hero.png)' }}
          />
          {/* Filigrane navy : garantit la lisibilité du texte blanc. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: 'hsl(var(--surface-inverse) / 0.78)' }}
          />
          {/* Fondu bas : raccord propre avec la bande claire suivante. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
            style={{
              background:
                'linear-gradient(180deg, transparent, hsl(var(--surface-inverse) / 0.35))',
            }}
          />
        </>
      )}

      <div
        className={cn(
          'relative mx-auto w-full max-w-[1280px] px-4 sm:px-6',
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
};

export default EventBand;
