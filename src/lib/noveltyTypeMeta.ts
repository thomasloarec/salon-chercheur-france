/**
 * Métadonnées partagées sur les types de nouveautés.
 * Source unique pour les libellés FR et le classement éditorial
 * (utilisé par la page /nouveautes pour le bloc "À la une").
 */

export const NOVELTY_TYPE_LABELS: Record<string, string> = {
  Launch: "Lancement produit",
  Update: "Mise à jour",
  Demo: "Démonstration",
  Special_Offer: "Offre spéciale",
  Partnership: "Partenariat",
  Innovation: "Innovation",
};

/** Types considérés comme "forts" éditorialement (mis en avant en priorité). */
export const IMPORTANT_NOVELTY_TYPES = new Set<string>([
  "Launch",
  "Demo",
  "Innovation",
]);

export function noveltyTypeLabel(type: string | null | undefined): string {
  if (!type) return "Nouveauté";
  return NOVELTY_TYPE_LABELS[type] ?? type;
}

export function isImportantNoveltyType(type: string | null | undefined): boolean {
  return !!type && IMPORTANT_NOVELTY_TYPES.has(type);
}