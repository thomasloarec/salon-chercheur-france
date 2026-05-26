import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_SECTORS, normalizeSectorSlug, sectorSlugToDbLabels } from '@/lib/taxonomy';
import { normalizeEventRow } from '@/lib/normalizeEvent';
import type { CanonicalEvent } from '@/types/lotexpo';

export const SECTOR_YEAR_INDEX_THRESHOLD = 3;

export interface SectorYearBreakdown {
  year: number;
  count: number;
  indexable: boolean;
}

export interface SectorHubData {
  sectorSlug: string;
  sectorLabel: string;
  description: string;
  upcomingEvents: CanonicalEvent[];
  pastEvents: CanonicalEvent[];
  totalCount: number;
  topCities: string[];
  /** For year-scoped pages: the year applied to the filter, otherwise null. */
  year: number | null;
  /** Breakdown of upcoming events per year (date_debut year >= today's year). */
  yearsBreakdown: SectorYearBreakdown[];
}

export interface UseSectorHubOptions {
  /** When set, scopes upcomingEvents to events whose start_date is in this calendar year. */
  year?: number | null;
}

export function useSectorHub(slug: string | undefined, options: UseSectorHubOptions = {}) {
  const year = options.year ?? null;
  return useQuery({
    queryKey: ['sector-hub', slug, year],
    queryFn: async (): Promise<SectorHubData | null> => {
      if (!slug) return null;

      const normalized = normalizeSectorSlug(slug);
      if (!normalized) return null;

      const sector = CANONICAL_SECTORS.find(s => s.value === normalized);
      if (!sector) return null;

      const dbLabels = sectorSlugToDbLabels(normalized);
      if (dbLabels.length === 0) return null;

      // Use filter with explicit JSON string to avoid encoding issues with '&' in PostgREST
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visible', true)
        .eq('is_test', false)
        .filter('secteur', 'cs', JSON.stringify([dbLabels[0]]))
        .order('date_debut', { ascending: true });

      if (error) {
        console.error('[useSectorHub] query error:', error);
        throw error;
      }

      const events = (data ?? []).map(normalizeEventRow);
      const todayStr = new Date().toISOString().slice(0, 10);
      const currentYear = new Date().getFullYear();

      const upcoming = events.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end >= todayStr : false;
      });

      const past = events.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end < todayStr : false;
      }).reverse(); // Most recent first

      // Years breakdown built from upcoming events (current year and beyond)
      const yearCount: Record<number, number> = {};
      upcoming.forEach(e => {
        if (!e.start_date) return;
        const y = Number(String(e.start_date).slice(0, 4));
        if (!Number.isFinite(y) || y < currentYear) return;
        yearCount[y] = (yearCount[y] || 0) + 1;
      });
      const yearsBreakdown: SectorYearBreakdown[] = Object.entries(yearCount)
        .map(([y, c]) => ({ year: Number(y), count: c, indexable: c >= SECTOR_YEAR_INDEX_THRESHOLD }))
        .sort((a, b) => a.year - b.year);

      // Year-scoped mode: replace upcoming with strict-year events (past or future),
      // and clear pastEvents to avoid mixing years on a year page.
      let upcomingScoped = upcoming;
      let pastScoped = past;
      if (year !== null) {
        upcomingScoped = events.filter(e => {
          if (!e.start_date) return false;
          return Number(String(e.start_date).slice(0, 4)) === year;
        });
        pastScoped = [];
      }

      // Top cities (scoped to current dataset for accurate cards)
      const baseForCities = year !== null ? upcomingScoped : events;
      const cityCount: Record<string, number> = {};
      baseForCities.forEach(e => {
        if (e.ville) {
          cityCount[e.ville] = (cityCount[e.ville] || 0) + 1;
        }
      });
      const topCities = Object.entries(cityCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([city]) => city);

      return {
        sectorSlug: normalized,
        sectorLabel: sector.label,
        description: year !== null
          ? `Retrouvez les salons professionnels du secteur ${sector.label} programmés en France en ${year}. Cette page regroupe les événements de l'année avec leurs dates, villes, lieux et liens vers les fiches détaillées.`
          : `Retrouvez tous les salons professionnels du secteur ${sector.label} en France. Consultez les dates, lieux et informations pratiques pour planifier vos visites.`,
        upcomingEvents: upcomingScoped,
        pastEvents: pastScoped,
        totalCount: events.length,
        topCities,
        year,
        yearsBreakdown,
      };
    },
    enabled: !!slug,
    staleTime: 300_000,
  });
}
