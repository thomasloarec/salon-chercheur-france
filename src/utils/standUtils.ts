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

/**
 * Format compact pour les cartes : premier emplacement + reste compté.
 * Ex. "H7.2-R007, A12, B3" -> "H7.2-R007 +2".
 * Le format des stands n'est pas normalisé : on coupe simplement à la
 * première virgule, c'est robuste et suffisant.
 */
export function formatStandShort(stand: string | null | undefined): string | null {
  const normalized = normalizeStandNumber(stand);
  if (!normalized) return null;

  const parts = normalized
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) return parts[0] ?? normalized;
  return `${parts[0]} +${parts.length - 1}`;
}
