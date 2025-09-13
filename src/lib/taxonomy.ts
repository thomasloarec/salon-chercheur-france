// src/lib/taxonomy.ts
export type TaxoOption = { value: string; label: string };

// ⚠️ Slugs figés (kebab-case, sans accents)
export const CANONICAL_SECTORS: TaxoOption[] = [
  { value: "agroalimentaire-boissons", label: "Agroalimentaire & Boissons" },
  { value: "automobile-mobilites", label: "Automobile & Mobilités" },
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