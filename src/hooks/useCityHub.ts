import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeEventRow } from '@/lib/normalizeEvent';
import type { CanonicalEvent } from '@/types/lotexpo';

export interface CityHubData {
  citySlug: string;
  cityName: string;
  description: string;
  upcomingEvents: CanonicalEvent[];
  pastEvents: CanonicalEvent[];
  totalCount: number;
  topVenues: string[];
  topSectors: string[];
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

export function useCityHub(slug: string | undefined) {
  return useQuery({
    queryKey: ['city-hub', slug],
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

      // Find city name matching slug
      const cityNames = new Set(events.map(e => e.ville).filter(Boolean) as string[]);
      const cityName = Array.from(cityNames).find(c => cityNameToSlug(c) === slug);

      if (!cityName) return null;

      const cityEvents = events.filter(e => e.ville === cityName);
      if (cityEvents.length < 3) return null; // Minimum threshold

      const todayStr = new Date().toISOString().slice(0, 10);

      const upcoming = cityEvents.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end >= todayStr : false;
      });

      const past = cityEvents.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end < todayStr : false;
      }).reverse();

      // Top venues
      const venueCount: Record<string, number> = {};
      cityEvents.forEach(e => {
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
      cityEvents.forEach(e => {
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
        description: `Découvrez les salons professionnels à ${cityName}. Calendrier complet, secteurs représentés et informations pratiques.${venueText}`,
        upcomingEvents: upcoming,
        pastEvents: past,
        totalCount: cityEvents.length,
        topVenues,
        topSectors,
      };
    },
    enabled: !!slug,
    staleTime: 300_000,
  });
}
