import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_SECTORS, normalizeSectorSlug, sectorSlugToDbLabels } from '@/lib/taxonomy';
import { normalizeEventRow } from '@/lib/normalizeEvent';
import type { CanonicalEvent } from '@/types/lotexpo';

export interface SectorHubData {
  sectorSlug: string;
  sectorLabel: string;
  description: string;
  upcomingEvents: CanonicalEvent[];
  pastEvents: CanonicalEvent[];
  totalCount: number;
  topCities: string[];
}

export function useSectorHub(slug: string | undefined) {
  return useQuery({
    queryKey: ['sector-hub', slug],
    queryFn: async (): Promise<SectorHubData | null> => {
      if (!slug) return null;

      const normalized = normalizeSectorSlug(slug);
      if (!normalized) return null;

      const sector = CANONICAL_SECTORS.find(s => s.value === normalized);
      if (!sector) return null;

      const dbLabels = sectorSlugToDbLabels(normalized);
      if (dbLabels.length === 0) return null;

      // Query events matching this sector via JSONB contains
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visible', true)
        .eq('is_test', false)
        .contains('secteur', [dbLabels[0]])
        .order('date_debut', { ascending: true });

      if (error) throw error;

      const events = (data ?? []).map(normalizeEventRow);
      const todayStr = new Date().toISOString().slice(0, 10);

      const upcoming = events.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end >= todayStr : false;
      });

      const past = events.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end < todayStr : false;
      }).reverse(); // Most recent first

      // Top cities
      const cityCount: Record<string, number> = {};
      events.forEach(e => {
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
        description: `Retrouvez tous les salons professionnels du secteur ${sector.label} en France. Consultez les dates, lieux et informations pratiques pour planifier vos visites.`,
        upcomingEvents: upcoming,
        pastEvents: past,
        totalCount: events.length,
        topCities,
      };
    },
    enabled: !!slug,
    staleTime: 300_000,
  });
}
