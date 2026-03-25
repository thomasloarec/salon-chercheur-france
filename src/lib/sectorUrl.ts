import { CANONICAL_SECTORS, sectorLabelToSlug } from '@/lib/taxonomy';

/**
 * Returns the URL for a sector hub page /secteur/{slug}.
 * Accepts either a sector label ("Industrie & Production") or a slug ("industrie-production").
 */
export function getSectorUrl(sector: string): string {
  // Try to resolve as label first
  const slug = sectorLabelToSlug(sector);
  if (slug) return `/secteur/${slug}`;

  // Already a slug?
  const found = CANONICAL_SECTORS.find(s => s.value === sector);
  if (found) return `/secteur/${sector}`;

  // Fallback: encode as query param
  return `/events?sectors=${encodeURIComponent(sector)}`;
}
