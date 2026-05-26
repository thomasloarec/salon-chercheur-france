// Mirror of src/lib/cityAliases.ts for build scripts.
export const CITY_ALIASES = {
  chassieu: { slug: 'lyon', name: 'Lyon' },
  villepinte: { slug: 'paris', name: 'Paris' },
  'paris-nord-villepinte': { slug: 'paris', name: 'Paris' },
  bruz: { slug: 'rennes', name: 'Rennes' },
};

export function getCityHubSlug(rawSlug) {
  if (!rawSlug) return null;
  return (CITY_ALIASES[rawSlug] && CITY_ALIASES[rawSlug].slug) || rawSlug;
}

export const CANONICAL_HUB_CITY_NAMES = {
  lyon: 'Lyon',
  paris: 'Paris',
  rennes: 'Rennes',
};