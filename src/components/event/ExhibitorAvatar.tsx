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
  /** Lot 18 — habillage de l'image (padding) pour les grandes tailles */
  imageClassName?: string;
}

/**
 * Lot 6 / 11 — visuel d'exposant à trois niveaux :
 * 1. logo_url (fiche revendiquée, ~53 profils sur 27 429)
 * 2. favicon dérivé du site web via getExhibitorLogoUrl
 * 3. monogramme typographique (Playfair sur une surface dérivée du nom)
 *
 * Lot 11 — le niveau 3 se déclenche désormais aussi quand l'image échoue
 * (`onError`) ET quand elle se charge « vide » : le service de favicons
 * renvoie un globe générique de 16 px quand le domaine n'en publie pas,
 * ce qui produisait le carré vide observé (Özel Tekstil, Pakipek Group).
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

/** Surfaces de repli, toutes issues des tokens de la palette. */
const MONOGRAM_TONES = [
  'bg-violet-soft text-primary ring-primary/15',
  'bg-surface-accent text-surface-accent-foreground ring-foreground/10',
  'bg-accent text-accent-foreground ring-primary/15',
  'bg-surface-inverse text-inverse ring-primary/30',
] as const;

function toneForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return MONOGRAM_TONES[hash % MONOGRAM_TONES.length];
}

/** En dessous de ce seuil, l'image rendue est un placeholder générique. */
const MIN_USABLE_PX = 24;

export const ExhibitorAvatar: React.FC<ExhibitorAvatarProps> = ({
  name,
  logoUrl,
  website,
  className,
  textClassName,
}) => {
  const resolved = getExhibitorLogoUrl(logoUrl, website);
  const [failed, setFailed] = useState(false);
  const showImage = !!resolved && !failed;

  // Le monogramme est TOUJOURS rendu, en couche de fond. L'image se pose
  // par-dessus. Un favicon transparent ou blanc — cas de Özel Tekstil et
  // Pakipek Group — laisse donc apparaître le monogramme au lieu d'un carré
  // vide. Le pixel ne peut pas être inspecté : le service de favicons de
  // Google ne renvoie pas d'en-tête CORS, le canvas serait teinté.
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-lg ring-1',
        toneForName(name),
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

      {showImage && (
        <img
          src={resolved}
          alt=""
          loading="lazy"
          decoding="async"
          width={64}
          height={64}
          className="absolute inset-0 h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            const img = e.currentTarget;
            // Favicon générique 16 px servi par défaut quand le domaine n'en
            // publie pas → on retombe sur le seul monogramme.
            if (img.naturalWidth < MIN_USABLE_PX || img.naturalHeight < MIN_USABLE_PX) {
              setFailed(true);
            }
          }}
        />
      )}
    </div>
  );
};

export default ExhibitorAvatar;
