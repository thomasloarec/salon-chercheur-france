import { cityNameToSlug } from '@/hooks/useCityHub';

/**
 * Returns the URL for a city hub page.
 */
export function getCityUrl(cityName: string): string {
  return `/ville/${cityNameToSlug(cityName)}`;
}
