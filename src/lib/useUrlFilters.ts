import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { normalizeSectorSlug } from "@/lib/taxonomy";
import { normalizeRegion } from "@/lib/regions";
import { SENTINEL_ALL } from "@/lib/urlFilters";

export type UrlFilters = {
  sectors: string[];      // liste de slugs canoniques (vide si "Tout")
  type: string | null;    // code (ou null)
  month: string | null;   // "01".."12" (ou null)
  region: string | null;  // slug région (ou null)
};

function norm(v: string | null): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed === "" || trimmed === SENTINEL_ALL ? null : trimmed;
}

export function useUrlFilters() {
  const [sp] = useSearchParams();

  // Lecture du nouveau param "sectors" (liste CSV)
  const rawSectors = norm(sp.get("sectors"));
  const sectors = useMemo(() => {
    if (!rawSectors) return [];
    return rawSectors
      .split(",")
      .map((s) => s.trim())
      .map((s) => normalizeSectorSlug(s))
      .filter((s): s is string => s !== null);
  }, [rawSectors]);

  const type = norm(sp.get("type"));
  const month = norm(sp.get("month"));   // "01".."12"
  const rawRegion = norm(sp.get("region"));
  const region = rawRegion ? normalizeRegion(rawRegion) : null;

  const filtersKey = useMemo(() => [
    sectors.length > 0 ? sectors.join(',') : 'all',
    type ?? 'all', 
    month ?? 'all',
    region ?? 'all'
  ], [sectors, type, month, region]);

  const filters = useMemo(() => ({ sectors, type, month, region }), [sectors, type, month, region]);

  return { filters, filtersKey };
}