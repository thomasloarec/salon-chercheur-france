// src/lib/taxonomy.ts
export type TaxoOption = { value: string; label: string };

// ⚠️ Slugs figés (kebab-case, sans accents)
export const CANONICAL_SECTORS: TaxoOption[] = [
  { value: "agroalimentaire-boissons", label: "Agroalimentaire & Boissons" },
  { value: "automobile-mobilite", label: "Automobile & Mobilité" }, // ← canonique
  { value: "commerce-distribution", label: "Commerce & Distribution" },
  { value: "cosmetique-bien-etre", label: "Cosmétique & Bien-être" },
  { value: "education-formation", label: "Éducation & Formation" },
  { value: "energie-environnement", label: "Énergie & Environnement" },
  { value: "industrie-production", label: "Industrie & Production" },
  { value: "mode-textile", label: "Mode & Textile" },
  { value: "sante-medical", label: "Santé & Médical" },
  { value: "technologie-innovation", label: "Technologie & Innovation" },
  { value: "tourisme-evenementiel", label: "Tourisme & Événementiel" },
  { value: "finance-assurance-immobilier", label: "Finance, Assurance & Immobilier" },
  { value: "services-entreprises-rh", label: "Services aux Entreprises & RH" },
  { value: "secteur-public-collectivites", label: "Secteur Public & Collectivités" },
];

// Alias pour absorber d'anciens slugs et éviter les doublons dans l'UI & les URLs
export const SECTOR_ALIASES: Record<string, string> = {
  "automobile-mobilites": "automobile-mobilite", // ← ancien → nouveau
};

// Normalisation universelle d'un slug secteur
export function normalizeSectorSlug(slug?: string | null) {
  if (!slug) return slug;
  const trimmed = String(slug).trim();
  return SECTOR_ALIASES[trimmed] ?? trimmed;
}

export const SECTOR_DB_LABELS: Record<string, string[]> = {
  "agroalimentaire-boissons": ["Agroalimentaire & Boissons"],
  "automobile-mobilite": ["Automobile & Mobilité"], // NB: BdD = singulier confirmé
  "commerce-distribution": ["Commerce & Distribution"],
  "cosmetique-bien-etre": ["Cosmétique & Bien-être"],
  "education-formation": ["Éducation & Formation"],
  "energie-environnement": ["Énergie & Environnement"],
  "industrie-production": ["Industrie & Production"],
  "mode-textile": ["Mode & Textile"],
  "sante-medical": ["Santé & Médical"],
  "technologie-innovation": ["Technologie & Innovation"],
  "tourisme-evenementiel": ["Tourisme & Événementiel"],
  "finance-assurance-immobilier": ["Finance, Assurance & Immobilier"],
  "services-entreprises-rh": ["Services aux Entreprises & RH"],
  "secteur-public-collectivites": ["Secteur Public & Collectivités"],
};

// Mapping slug → libellés DB pour filtrage secteur
export function sectorSlugToDbLabels(slug: string): string[] {
  const s = normalizeSectorSlug(slug);
  const labels = (s && SECTOR_DB_LABELS[s]) || [];
  const fallback = CANONICAL_SECTORS.find(o => o.value === s)?.label;
  return labels.length ? labels : (fallback ? [fallback] : []);
}

/** Types: valeur DB = `type_event` (ex: "salon", "conference", "forum", etc.) */
export const CANONICAL_EVENT_TYPES = [
  { value: "salon", label: "Salon" },
  { value: "conference", label: "Conférence" },
  { value: "forum", label: "Forum" },
  { value: "webinar", label: "Webinar" },
  // Ajoutez si besoin d'autres valeurs EXACTEMENT comme en DB
];

export function typeSlugToDbValue(slug: string | null): string | null {
  if (!slug) return null;
  // Ici, la value UI = la valeur DB (ex.: "salon") → renvoyer tel quel
  return slug;
}