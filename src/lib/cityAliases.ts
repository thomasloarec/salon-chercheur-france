import { cityNameToSlug } from '@/hooks/useCityHub';

/**
 * Villes-satellites rattachées à une grande ville (le parc des expositions
 * y est souvent associé). Les événements de ces communes sont rattachés
 * au hub de la ville principale pour ne pas être manqués par les internautes.
 * Clé = slug de la commune réelle, valeur = { slug, name } de la ville parent.
 */
export const CITY_ALIASES: Record<string, { slug: string; name: string }> = {
  chassieu: { slug: 'lyon', name: 'Lyon' },
  villepinte: { slug: 'paris', name: 'Paris' },
  'paris-nord-villepinte': { slug: 'paris', name: 'Paris' },
  bruz: { slug: 'rennes', name: 'Rennes' },
};

/** Retourne le slug du hub ville auquel une commune doit être rattachée. */
export function getCityHubSlug(ville: string | null | undefined): string | null {
  if (!ville) return null;
  const raw = cityNameToSlug(ville);
  if (!raw) return null;
  return CITY_ALIASES[raw]?.slug ?? raw;
}

/** Nom canonique du hub ville pour un slug donné (ex: lyon -> Lyon). */
export const CANONICAL_HUB_CITY_NAMES: Record<string, string> = {
  lyon: 'Lyon',
  paris: 'Paris',
  rennes: 'Rennes',
};