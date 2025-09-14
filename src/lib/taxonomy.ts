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

// Mapping slug → libellés DB pour filtrage secteur
export function sectorSlugToDbLabels(slug: string): string[] {
  const normalized = normalizeSectorSlug(slug);
  const sector = CANONICAL_SECTORS.find(s => s.value === normalized);
  if (!sector) return [];
  
  // Retourner le label officiel + variantes communes
  const baseLabel = sector.label;
  const variations = [baseLabel];
  
  // Ajouter des variations communes pour améliorer la compatibilité
  if (baseLabel.includes("&")) {
    variations.push(baseLabel.replace("&", "et"));
  }
  if (baseLabel.includes(" & ")) {
    variations.push(baseLabel.replace(" & ", " et "));
  }
  
  return [...new Set(variations)]; // dédupe
}