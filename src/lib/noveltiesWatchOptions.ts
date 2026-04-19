import { CANONICAL_SECTORS as TAXO_SECTORS } from "@/lib/taxonomy";

export const CANONICAL_SECTORS = TAXO_SECTORS;

// Types de nouveautés (champ `type` de la table `novelties`)
// Aligné avec NOVELTY_TYPES dans src/types/lotexpo.ts
export const NOVELTY_TYPES_OPTIONS = [
  { value: "Launch", label: "Lancement produit" },
  { value: "Update", label: "Mise à jour" },
  { value: "Demo", label: "Démonstration" },
  { value: "Special_Offer", label: "Offre spéciale" },
  { value: "Partnership", label: "Partenariat" },
  { value: "Innovation", label: "Innovation" },
];
