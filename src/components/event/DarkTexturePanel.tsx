import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Lot 11 — panneau au registre sombre texturé, réutilisant la texture de la
 * page d'accueil (/home-texture-plexus.jpg). Employé par les états d'attente
 * des nouveautés, qui concernent la très grande majorité des pages salon et
 * doivent être traités comme des invitations, pas comme des absences.
 *
 * Contenu en hauteur : la texture donne de la matière, elle n'agrandit pas
 * le bloc.
 */
export const DarkTexturePanel: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <div
    className={cn(
      'relative overflow-hidden rounded-2xl bg-surface-inverse text-inverse',
      className,
    )}
  >
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
          'radial-gradient(85% 65% at 50% 40%, transparent, hsl(var(--surface-inverse) / 0.88))',
      }}
    />
    <div className="relative">{children}</div>
  </div>
);

export default DarkTexturePanel;
