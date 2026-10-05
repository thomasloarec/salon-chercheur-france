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

  // Fallback
  return '/salons';
}

/**
 * Returns the hub URL of the primary sector of an event.
 * Accepts the raw `secteur` value (array or string). Never splits on commas.
 */
export function getPrimarySectorUrl(secteur: unknown): string {
  let raw: unknown;
  if (Array.isArray(secteur)) raw = secteur[0];
  else if (typeof secteur === 'string') raw = secteur;
  else return '/salons';
  if (typeof raw !== 'string') return '/salons';
  const value = raw.trim();
  if (!value) return '/salons';
  const lower = value.toLowerCase();
  const sorted = [...CANONICAL_SECTORS].sort((a, b) => b.label.length - a.label.length);
  const match = sorted.find((s) => {
    const label = s.label.toLowerCase();
    return lower === label || lower.startsWith(label);
  });
  if (match) return `/secteur/${match.value}`;
  if (CANONICAL_SECTORS.some((s) => s.value === value)) return `/secteur/${value}`;
  return '/salons';
}
