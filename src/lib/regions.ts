// src/lib/regions.ts
export type RegionMeta = { slug: string; name: string; code: string }; // code INSEE 2016

export const REGIONS: Record<string, RegionMeta> = {
  "ile-de-france": { slug: "ile-de-france", name: "Île-de-France", code: "11" },
  "centre-val-de-loire": { slug: "centre-val-de-loire", name: "Centre-Val de Loire", code: "24" },
  "bourgogne-franche-comte": { slug: "bourgogne-franche-comte", name: "Bourgogne-Franche-Comté", code: "27" },
  "normandie": { slug: "normandie", name: "Normandie", code: "28" },
  "hauts-de-france": { slug: "hauts-de-france", name: "Hauts-de-France", code: "32" },
  "grand-est": { slug: "grand-est", name: "Grand Est", code: "44" },
  "pays-de-la-loire": { slug: "pays-de-la-loire", name: "Pays de la Loire", code: "52" },
  "bretagne": { slug: "bretagne", name: "Bretagne", code: "53" },
  "nouvelle-aquitaine": { slug: "nouvelle-aquitaine", name: "Nouvelle-Aquitaine", code: "75" },
  "occitanie": { slug: "occitanie", name: "Occitanie", code: "76" },
  "auvergne-rhone-alpes": { slug: "auvergne-rhone-alpes", name: "Auvergne-Rhône-Alpes", code: "84" },
  "provence-alpes-cote-d-azur": { slug: "provence-alpes-cote-d-azur", name: "Provence-Alpes-Côte d'Azur", code: "93" },
  "corse": { slug: "corse", name: "Corse", code: "94" },
  // DROM
  "guadeloupe": { slug: "guadeloupe", name: "Guadeloupe", code: "01" },
  "martinique": { slug: "martinique", name: "Martinique", code: "02" },
  "guyane": { slug: "guyane", name: "Guyane", code: "03" },
  "la-reunion": { slug: "la-reunion", name: "La Réunion", code: "04" },
  "mayotte": { slug: "mayotte", name: "Mayotte", code: "06" },
};

// Aliases acceptés (UI/URL) -> slug canonique
export const REGION_ALIASES: Record<string, string> = Object.values(REGIONS)
  .reduce((acc, r) => {
    acc[r.slug] = r.slug;                 // slug lui-même
    acc[r.code] = r.slug;                 // code INSEE (ex "11")
    acc[r.name.toLowerCase()] = r.slug;   // libellé
    acc[r.name.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase()] = r.slug; // libellé sans accents
    return acc;
  }, {} as Record<string,string>);

// Canonise n'importe quelle entrée (slug, code, libellé) vers le slug
export function normalizeRegion(value?: string | null): string | null {
  if (!value || value === "all") return null;
  const k = value.toLowerCase();
  return REGION_ALIASES[k] ?? null;
}