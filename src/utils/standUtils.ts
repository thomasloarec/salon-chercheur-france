/**
 * Normalise le numéro de stand en supprimant le préfixe "Stand" s'il existe.
 * Évite l'affichage "Stand Stand XYZ" quand la donnée contient déjà le mot.
 */
export function normalizeStandNumber(stand: string | null | undefined): string | null {
  if (!stand) return null;
  
  const trimmed = stand.trim();
  
  // Regex pour détecter "stand" au début (insensible à la casse), suivi d'un espace
  const standPrefixRegex = /^stand\s+/i;
  
  if (standPrefixRegex.test(trimmed)) {
    return trimmed.replace(standPrefixRegex, '').trim();
  }
  
  return trimmed;
}
