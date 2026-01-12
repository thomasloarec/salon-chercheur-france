// src/lib/taxonomy.ts
export type TaxoOption = { value: string; label: string };

// ⚠️ Slugs figés (kebab-case, sans accents)
export const CANONICAL_SECTORS: TaxoOption[] = [
  { value: "agroalimentaire-boissons", label: "Agroalimentaire & Boissons" },
  { value: "automobile-mobilite", label: "Automobile & Mobilité" }, // ← canonique
  { value: "btp-construction", label: "BTP & Construction" },
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
  "550e8400-e29b-41d4-a716-446655440003": "btp-construction", // ← UUID → slug canonique
};

// Normalisation universelle d'un slug secteur
export function normalizeSectorSlug(slug?: string | null): string | null {
  if (!slug) return null;
  const trimmed = String(slug).trim();
  
  // Si c'est déjà un slug canonique, le retourner
  const existingSlug = CANONICAL_SECTORS.find(s => s.value === trimmed);
  if (existingSlug) return trimmed;
  
  // Si c'est un alias, retourner le slug canonique
  if (SECTOR_ALIASES[trimmed]) return SECTOR_ALIASES[trimmed];
  
  // Si c'est un label (nom complet), trouver le slug correspondant
  const byLabel = CANONICAL_SECTORS.find(s => 
    s.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (byLabel) return byLabel.value;
  
  // Fallback: retourner tel quel (peut-être un nouveau slug non répertorié)
  return trimmed;
}

// Convertir un label de secteur en slug canonique
export function sectorLabelToSlug(label: string): string | null {
  const found = CANONICAL_SECTORS.find(s => 
    s.label.toLowerCase() === label.toLowerCase()
  );
  return found?.value ?? null;
}

export const SECTOR_DB_LABELS: Record<string, string[]> = {
  "agroalimentaire-boissons": ["Agroalimentaire & Boissons"],
  "automobile-mobilite": ["Automobile & Mobilité"], // NB: BdD = singulier confirmé
  "btp-construction": ["BTP & Construction"],
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