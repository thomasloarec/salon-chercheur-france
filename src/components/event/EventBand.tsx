import React from 'react';
import { cn } from '@/lib/utils';

export type BandTone = 'light-texture' | 'white' | 'dark-texture' | 'soft';
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
  // ~48 px mobile / 64 px tablette / 96 px desktop
  sm: 'py-8 md:py-10 lg:py-14',
  md: 'py-12 md:py-16 lg:py-24',
  lg: 'py-14 md:py-20 lg:py-28',
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
  const isDark = tone === 'dark-texture';

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
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70"
            style={{ backgroundImage: "url('/backgrounds/recherche-ia-bg.jpg')" }}
          />
          {/* Voile blanc : la texture donne de la matière sans jamais réduire
              le contraste du texte posé dessus. Le dégradé se ferme vers le bas
              pour raccorder proprement sur la bande blanche suivante. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, hsl(var(--background) / 0.42) 0%, hsl(var(--background) / 0.62) 55%, hsl(var(--background) / 0.95) 100%)',
            }}
          />
        </>
      )}

      {isDark && (
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
