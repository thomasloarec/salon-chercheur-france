import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackExhibitorEvent } from '@/lib/exhibitorTracking';
import type { FullProfileSurface } from '@/components/exhibitor/ExhibitorFullProfileCTA';

interface Options {
  /** Public slug from exhibitor_public_identities (already prefetched). */
  publicSlug?: string | null;
  /** Test identities never link out. */
  isTest?: boolean | null;
  /** Analytics surface — mirrors ExhibitorFullProfileCTA tracking. */
  surface: FullProfileSurface;
  eventSlug?: string;
  /** Called just before SPA navigation (e.g. close a modal). */
  onNavigate?: () => void;
}

export interface ExhibitorLinkProps {
  href: string;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Lot 17 — un exposant avec page publique devient un vrai lien.
 * Le clic gauche simple reste une navigation SPA ; Ctrl/⌘/clic milieu et
 * "ouvrir dans un nouvel onglet" gardent le comportement natif du navigateur.
 * `seo_indexable` n'entre JAMAIS dans la condition : il ne gouverne que le
 * référencement, pas l'existence de la page.
 */
export function useExhibitorLink({
  publicSlug,
  isTest,
  surface,
  eventSlug,
  onNavigate,
}: Options): ExhibitorLinkProps | null {
  const navigate = useNavigate();
  const href = publicSlug ? `/exposants/${publicSlug}` : '';

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      trackExhibitorEvent('full_profile_click', publicSlug || '', {
        source_surface: surface,
        public_slug: publicSlug,
        ...(eventSlug ? { event_slug: eventSlug } : {}),
      });
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return; // laisse le navigateur ouvrir un onglet / une fenêtre
      }
      e.preventDefault();
      onNavigate?.();
      navigate(href);
    },
    [publicSlug, surface, eventSlug, onNavigate, navigate, href],
  );

  if (!publicSlug || isTest) return null;
  return { href, onClick };
}

export default useExhibitorLink;
