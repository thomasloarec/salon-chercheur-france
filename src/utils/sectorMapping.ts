// Utility to map sector names from DB to canonical slugs used in iconMap

const SECTOR_NAME_TO_SLUG: Record<string, string> = {
  // Exact matches
  "automobile & mobilité": "automobile-mobilite",
  "automobile-mobilite": "automobile-mobilite",
  
  "commerce & distribution": "commerce-distribution",
  "commerce-distribution": "commerce-distribution",
  
  "cosmétique & bien-être": "cosmetique-bien-etre",
  "cosmetique-bien-etre": "cosmetique-bien-etre",
  
  "éducation & formation": "education-formation",
  "education-formation": "education-formation",
  
  "énergie & environnement": "energie-environnement",
  "energie-environnement": "energie-environnement",
  
  "industrie & production": "industrie-production",
  "industrie-production": "industrie-production",
  
  "mode & textile": "mode-textile",
  "mode-textile": "mode-textile",
  
  "santé & médical": "sante-medical",
  "sante-medical": "sante-medical",
  
  "technologie & innovation": "technologie-innovation",
  "technologie-innovation": "technologie-innovation",
  
  "tourisme & événementiel": "tourisme-evenementiel",
  "tourisme-evenementiel": "tourisme-evenementiel",
  
  "finance, assurance & immobilier": "finance-assurance-immobilier",
  "finance-assurance-immobilier": "finance-assurance-immobilier",
  
  "services aux entreprises & rh": "services-entreprises-rh",
  "services-entreprises-rh": "services-entreprises-rh",
  
  "secteur public & collectivités": "secteur-public-collectivites",
  "secteur-public-collectivites": "secteur-public-collectivites",
  
  "agroalimentaire & boissons": "agroalimentaire-boissons",
  "agroalimentaire-boissons": "agroalimentaire-boissons",
  
  "btp & construction": "btp-construction",
  "btp-construction": "btp-construction",
};

/**
 * Normalize a sector name to its canonical slug
 * Handles variations in capitalization, accents, and special characters
 */
export function normalizeSectorToSlug(sectorName: string | null | undefined): string | null {
  if (!sectorName) return null;
  
  // Normalize: lowercase, trim
  const normalized = sectorName.toLowerCase().trim();
  
  // Try exact match first
  if (SECTOR_NAME_TO_SLUG[normalized]) {
    return SECTOR_NAME_TO_SLUG[normalized];
  }
  
  // Try to generate slug from name
  const slug = normalized
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/\s+&\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
  
  return slug || null;
}

/**
 * Convert a Sector from DB to a format with proper slug for icon mapping
 */
export function sectorWithCanonicalSlug(sector: { id: string; name: string; slug?: string }) {
  // Priority: use existing slug field, then try to map name, then fallback to ID
  const canonicalSlug = 
    normalizeSectorToSlug(sector.slug) || 
    normalizeSectorToSlug(sector.name) || 
    sector.id.toLowerCase();
  
  return {
    id: sector.id,
    slug: canonicalSlug,
    name: sector.name
  };
}
