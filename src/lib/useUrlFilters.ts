import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { normalizeSectorSlug } from "@/lib/taxonomy";
import { SENTINEL_ALL } from "@/components/ui/SafeSelect";

export type UrlFilters = {
  sector: string | null;  // slug canonique (ou null)
  type: string | null;    // code (ou null)
  month: string | null;   // "01".."12" (ou null)
  region: string | null;  // code région (ou null)
};

function norm(v: string | null): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed === "" || trimmed === SENTINEL_ALL ? null : trimmed;
}

export function useUrlFilters(): UrlFilters {
  const [sp] = useSearchParams();

  // lecture + normalisation
  const rawSector = norm(sp.get("sector"));
  const sector = rawSector ? normalizeSectorSlug(rawSector) : null;

  const type = norm(sp.get("type"));
  const month = norm(sp.get("month"));   // "01".."12"
  const region = norm(sp.get("region"));

  return useMemo(() => ({ sector, type, month, region }), [sector, type, month, region]);
}