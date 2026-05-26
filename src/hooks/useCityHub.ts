import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeEventRow } from '@/lib/normalizeEvent';
import type { CanonicalEvent } from '@/types/lotexpo';
import { CITY_ALIASES, CANONICAL_HUB_CITY_NAMES } from '@/lib/cityAliases';

export const CITY_YEAR_INDEX_THRESHOLD = 3;

export interface CityYearBreakdown {
  year: number;
  count: number;
  indexable: boolean;
}

export interface CityHubData {
  citySlug: string;
  cityName: string;
  description: string;
  upcomingEvents: CanonicalEvent[];
  pastEvents: CanonicalEvent[];
  totalCount: number;
  topVenues: string[];
  topSectors: string[];
  /** For year-scoped pages: the year applied, otherwise null. */
  year: number | null;
  /** Breakdown of future events per year (current year and beyond). */
  yearsBreakdown: CityYearBreakdown[];
}

/** Normalise a city name to a URL slug (lowercase, no accents, hyphens). */
export function cityNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface UseCityHubOptions {
  /** When set, scopes upcomingEvents to FUTURE events of that calendar year. */
  year?: number | null;
}

export function useCityHub(slug: string | undefined, options: UseCityHubOptions = {}) {
  const year = options.year ?? null;
  return useQuery({
    queryKey: ['city-hub', slug, year],
    queryFn: async (): Promise<CityHubData | null> => {
      if (!slug) return null;

      // We need to find the actual city name from slug.
      // Fetch distinct cities from events and match.
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visible', true)
        .eq('is_test', false)
        .not('ville', 'is', null)
        .order('date_debut', { ascending: true });

      if (error) throw error;

      const events = (data ?? []).map(normalizeEventRow);

      // Map every event's ville to a hub slug (applying alias overrides
      // for satellite communes like Chassieu→Lyon, Villepinte→Paris…).
      const hubSlugOf = (v: string | null | undefined): string | null => {
        if (!v) return null;
        const raw = cityNameToSlug(v);
        if (!raw) return null;
        return CITY_ALIASES[raw]?.slug ?? raw;
      };

      // Resolve canonical city name for this hub slug.
      // 1) Prefer an event whose own ville slug matches the hub slug
      //    (e.g. an event in "Lyon" for the /ville/lyon hub).
      // 2) Fallback to a hardcoded canonical name (for hubs only fed by
      //    aliases, though normally these also have direct events).
      const directMatch = events.find(e => e.ville && cityNameToSlug(e.ville) === slug)?.ville;
      const cityName = directMatch ?? CANONICAL_HUB_CITY_NAMES[slug] ?? null;
      if (!cityName) return null;

      const cityEvents = events.filter(e => hubSlugOf(e.ville) === slug);
      // Evergreen needs the city to have ≥3 events overall; year pages render
      // even at 0 (they'll be noindex below threshold) so the route stays usable.
      if (year === null && cityEvents.length < 3) return null;

      const todayStr = new Date().toISOString().slice(0, 10);
      const currentYear = new Date().getFullYear();

      const upcoming = cityEvents.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end >= todayStr : false;
      });

      const past = cityEvents.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end < todayStr : false;
      }).reverse();

      // Years breakdown built from FUTURE events (current year and beyond).
      const yearCount: Record<number, number> = {};
      upcoming.forEach(e => {
        if (!e.start_date) return;
        const y = Number(String(e.start_date).slice(0, 4));
        if (!Number.isFinite(y) || y < currentYear) return;
        yearCount[y] = (yearCount[y] || 0) + 1;
      });
      const yearsBreakdown: CityYearBreakdown[] = Object.entries(yearCount)
        .map(([y, c]) => ({ year: Number(y), count: c, indexable: c >= CITY_YEAR_INDEX_THRESHOLD }))
        .sort((a, b) => a.year - b.year);

      // Year-scoped mode: FUTURE events of that year only, no past block.
      let upcomingScoped = upcoming;
      let pastScoped = past;
      if (year !== null) {
        upcomingScoped = upcoming.filter(e => {
          if (!e.start_date) return false;
          return Number(String(e.start_date).slice(0, 4)) === year;
        });
        pastScoped = [];
      }

      // Top venues
      const venueCount: Record<string, number> = {};
      const venueBase = year !== null ? upcomingScoped : cityEvents;
      venueBase.forEach(e => {
        if (e.nom_lieu) {
          venueCount[e.nom_lieu] = (venueCount[e.nom_lieu] || 0) + 1;
        }
      });
      const topVenues = Object.entries(venueCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([venue]) => venue);

      // Top sectors
      const sectorCount: Record<string, number> = {};
      const sectorBase = year !== null ? upcomingScoped : cityEvents;
      sectorBase.forEach(e => {
        e.secteur_labels.forEach(s => {
          sectorCount[s] = (sectorCount[s] || 0) + 1;
        });
      });
      const topSectors = Object.entries(sectorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([sector]) => sector);

      // Find dominant venue
      const mainVenue = topVenues.length > 0 ? topVenues[0] : null;
      const venueText = mainVenue ? ` Le principal lieu d'exposition est ${mainVenue}.` : '';

      return {
        citySlug: slug,
        cityName,
        description: year !== null
          ? `Retrouvez les salons professionnels programmés à ${cityName} en ${year}. Cette page regroupe les événements à venir avec leurs dates, lieux, secteurs d'activité et liens vers les fiches détaillées.${venueText}`
          : `Découvrez les salons professionnels à ${cityName}. Calendrier complet, secteurs représentés et informations pratiques.${venueText}`,
        upcomingEvents: upcomingScoped,
        pastEvents: pastScoped,
        totalCount: cityEvents.length,
        topVenues,
        topSectors,
        year,
        yearsBreakdown,
      };
    },
    enabled: !!slug,
    staleTime: 300_000,
  });
}
