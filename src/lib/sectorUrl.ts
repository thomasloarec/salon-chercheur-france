/**
 * Returns the URL for a sector page.
 * Currently points to /events?sectors=... but is designed to be
 * switched to /secteur/{slug} when hub pages are created.
 */
export function getSectorUrl(sector: string): string {
  // TODO: when sector hub pages exist, return `/secteur/${slugify(sector)}`
  return `/events?sectors=${encodeURIComponent(sector)}`;
}
