/**
 * Phase d'un salon relative à aujourd'hui (date locale), calculée à partir
 * des dates du payload — utilisée pour piloter la visibilité/mise en avant
 * des actions « Mode salon » et « Débrief ».
 *
 *  - `before` : aujourd'hui < D1 (date_debut)
 *  - `during` : D1 ≤ aujourd'hui ≤ D2 (date_fin, ou D1 si nulle)
 *  - `after`  : aujourd'hui > D2
 *  - `unknown`: date_debut absente → on ne devine pas la phase
 */
export type EventPhase = 'before' | 'during' | 'after' | 'unknown';

/** YYYY-MM-DD local (pas UTC). */
function todayLocalYmd(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function eventPhase(
  dateDebut: string | null | undefined,
  dateFin: string | null | undefined,
): EventPhase {
  if (!dateDebut) return 'unknown';
  const today = todayLocalYmd();
  const d1 = dateDebut.slice(0, 10);
  const d2 = (dateFin ?? dateDebut).slice(0, 10);
  if (today < d1) return 'before';
  if (today > d2) return 'after';
  return 'during';
}

/** Le bouton « Mode salon » est masqué uniquement après le salon. */
export function showModeSalon(phase: EventPhase): boolean {
  return phase !== 'after';
}

/** « Mode salon » est mis en avant (accent fort) uniquement pendant le salon. */
export function modeSalonIsHot(phase: EventPhase): boolean {
  return phase === 'during' || phase === 'unknown';
}

/** Le bouton « Débrief » est masqué uniquement avant le salon. */
export function showDebrief(phase: EventPhase): boolean {
  return phase !== 'before';
}
