import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeEventRow } from '@/lib/normalizeEvent';
import type { CanonicalEvent } from '@/types/lotexpo';
import { CITY_ALIASES, CANONICAL_HUB_CITY_NAMES } from '@/lib/cityAliases';
import { cityNameToSlug } from '@/hooks/useCityHub';
import { sectorLabelToSlug } from '@/lib/taxonomy';

export const ANNUAL_HUB_THRESHOLD = 3;

export interface AnnualSectorItem { slug: string; label: string; count: number }
export interface AnnualCityItem { slug: string; name: string; count: number }
export interface AnnualMonthGroup { monthLabel: string; events: CanonicalEvent[]; total: number }

export interface AnnualHubData {
  year: number;
  events: CanonicalEvent[];
  totalCount: number;
  sectors: AnnualSectorItem[];
  cities: AnnualCityItem[];
  monthGroups: AnnualMonthGroup[];
  featured: CanonicalEvent[];
  periodStart: string | null;
  periodEnd: string | null;
}

export function useAnnualHub(year: number) {
  return useQuery({
    queryKey: ['annual-hub', year],
    queryFn: async (): Promise<AnnualHubData> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visible', true)
        .eq('is_test', false)
        .gte('date_debut', `${year}-01-01`)
        .lte('date_debut', `${year}-12-31`)
        .order('date_debut', { ascending: true });
      if (error) throw error;

      const todayStr = new Date().toISOString().slice(0, 10);
      const all = (data ?? []).map(normalizeEventRow);
      const events = all.filter(e => {
        const end = e.end_date || e.start_date;
        return end ? end >= todayStr : false;
      });

      // Sectors (canonical only, count >= threshold)
      const sectorAcc: Record<string, { label: string; count: number }> = {};
      for (const e of events) {
        for (const lbl of e.secteur_labels ?? []) {
          const slug = sectorLabelToSlug(lbl);
          if (!slug) continue;
          sectorAcc[slug] = sectorAcc[slug] || { label: lbl, count: 0 };
          sectorAcc[slug].count++;
        }
      }
      const sectors = Object.entries(sectorAcc)
        .filter(([, v]) => v.count >= ANNUAL_HUB_THRESHOLD)
        .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count);

      // Cities (with satellite-merge, count >= threshold)
      const cityAcc: Record<string, { name: string; count: number }> = {};
      for (const e of events) {
        if (!e.ville) continue;
        const raw = cityNameToSlug(e.ville);
        if (!raw) continue;
        const hubSlug = CITY_ALIASES[raw]?.slug ?? raw;
        const hubName = CITY_ALIASES[raw]?.name ?? CANONICAL_HUB_CITY_NAMES[hubSlug] ?? e.ville;
        if (!cityAcc[hubSlug]) cityAcc[hubSlug] = { name: hubName, count: 0 };
        // Prefer the canonical hub name if we encounter a direct match
        if (raw === hubSlug) cityAcc[hubSlug].name = e.ville;
        cityAcc[hubSlug].count++;
      }
      const cities = Object.entries(cityAcc)
        .filter(([, v]) => v.count >= ANNUAL_HUB_THRESHOLD)
        .map(([slug, v]) => ({ slug, name: v.name, count: v.count }))
        .sort((a, b) => b.count - a.count);

      // Months
      const monthMap: Record<string, CanonicalEvent[]> = {};
      const monthOrder: string[] = [];
      for (const e of events) {
        if (!e.start_date) continue;
        const d = new Date(e.start_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!(key in monthMap)) { monthMap[key] = []; monthOrder.push(key); }
        monthMap[key].push(e);
      }
      const monthGroups: AnnualMonthGroup[] = monthOrder.map(k => {
        const [y, m] = k.split('-');
        const label = new Date(Number(y), Number(m) - 1, 1)
          .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        return { monthLabel: label, events: monthMap[k].slice(0, 6), total: monthMap[k].length };
      });

      const featured = events.slice(0, 6);

      return {
        year,
        events,
        totalCount: events.length,
        sectors,
        cities,
        monthGroups,
        featured,
        periodStart: events[0]?.start_date ?? null,
        periodEnd: events[events.length - 1]?.end_date ?? events[events.length - 1]?.start_date ?? null,
      };
    },
    staleTime: 300_000,
  });
}