import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { getExhibitorLogoUrl } from '@/utils/exhibitorLogo';

interface ExhibitorAvatarProps {
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  className?: string;
  /** Taille du texte de repli */
  textClassName?: string;
}

/**
 * Lot 6 — visuel d'exposant à trois niveaux :
 * 1. logo_url (fiche revendiquée, ~0,2 % des profils)
 * 2. favicon dérivé du site web via getExhibitorLogoUrl (~99 % des profils)
 * 3. repli typographique soigné (monogramme sur fond violet clair)
 *
 * Le repli couvre aussi le cas d'un favicon renvoyant une 404.
 */
export function getMonogram(name: string): string {
  const words = (name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '•';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const ExhibitorAvatar: React.FC<ExhibitorAvatarProps> = ({
  name,
  logoUrl,
  website,
  className,
  textClassName,
}) => {
  const resolved = getExhibitorLogoUrl(logoUrl, website);
  const [failed, setFailed] = useState(false);

  if (!resolved || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-accent text-accent-foreground ring-1 ring-primary/15',
          className,
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            'heading-display font-semibold leading-none tracking-tight',
            textClassName ?? 'text-base',
          )}
        >
          {getMonogram(name)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-lg border bg-white p-1',
        className,
      )}
    >
      <img
        src={resolved}
        alt=""
        loading="lazy"
        decoding="async"
        width={64}
        height={64}
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

export default ExhibitorAvatar;
