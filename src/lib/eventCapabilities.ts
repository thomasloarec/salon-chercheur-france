/**
 * Source unique de vérité pour les règles métier de la page salon.
 * Aucune dépendance React — testable isolément.
 */

export type EventTemporalState =
  | 'lointain'
  | 'proche'
  | 'imminent'
  | 'en_cours'
  | 'termine';

/** Seuil unique du Parcours IA (préparation de visite). */
export const PARCOURS_IA_MIN_EXHIBITORS = 80;

/** Fenêtre d'ouverture de la publication de nouveautés (jours avant le salon). */
export const NOVELTY_OPEN_DAYS_BEFORE = 90;

type DateLike = string | null | undefined;

/** Normalise une date en 'YYYY-MM-DD' (comparaison en jours calendaires). */
function toDayString(value: DateLike): string | null {
  if (!value) return null;
  const str = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffCalendarDays(fromDay: string, toDay: string): number {
  const a = Date.UTC(
    Number(fromDay.slice(0, 4)),
    Number(fromDay.slice(5, 7)) - 1,
    Number(fromDay.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(toDay.slice(0, 4)),
    Number(toDay.slice(5, 7)) - 1,
    Number(toDay.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

export function getEventTemporalState(
  dateDebut: DateLike,
  dateFin: DateLike,
): EventTemporalState {
  const start = toDayString(dateDebut);
  const end = toDayString(dateFin) ?? start;
  if (!start && !end) return 'lointain';

  const today = todayString();

  // date_fin est inclusive : tant que fin >= aujourd'hui, l'événement n'est pas terminé.
  if (end && end < today) return 'termine';
  if (!start) return 'lointain';
  if (start <= today && end && end >= today) {
    return start === today ? 'imminent' : 'en_cours';
  }
  const days = diffCalendarDays(today, start);
  if (days > 90) return 'lointain';
  return 'proche';
}

/** Compatibilité : équivaut à getEventTemporalState(...) === 'termine'. */
export function isEventPast(dateDebut: DateLike, dateFin: DateLike): boolean {
  return getEventTemporalState(dateDebut, dateFin) === 'termine';
}

/** Durée inclusive en jours (1er → 3 septembre = 3 jours). */
export function getEventDurationDays(
  dateDebut: DateLike,
  dateFin: DateLike,
): number | null {
  const start = toDayString(dateDebut);
  const end = toDayString(dateFin);
  if (!start || !end) return null;
  const days = diffCalendarDays(start, end) + 1;
  return days > 0 ? days : null;
}

/**
 * Renvoie la valeur numérique d'affluence, ou null si la donnée n'est pas exploitable
 * ("non communiqué", "nc", "n/a"…). Sert uniquement à décider si la donnée existe :
 * l'affichage reste géré par formatAffluenceWithSuffix.
 */
export function parseAffluence(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null;

  // Même normalisation que formatAffluence : le point est un séparateur de milliers.
  const cleaned = String(raw).replace(/\./g, '').replace(/\s/g, '').trim();
  if (!cleaned) return null;
  if (!/^\d/.test(cleaned)) return null; // "non communiqué", "nc", "n/a", "inconnu"…

  const value = parseInt(cleaned, 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

interface CapabilityEvent {
  date_debut?: string | null;
  date_fin?: string | null;
  affluence?: string | number | null;
}

export interface EventCapabilities {
  temporalState: EventTemporalState;
  isPast: boolean;
  canPrepareVisit: boolean;
  canPublishNovelty: boolean;
  showRadarCrm: boolean;
  showExhibitorSection: boolean;
  durationDays: number | null;
  affluenceValue: number | null;
}

export function getEventCapabilities(
  event: CapabilityEvent,
  exhibitorCount: number,
): EventCapabilities {
  const temporalState = getEventTemporalState(event.date_debut, event.date_fin);
  const past = temporalState === 'termine';

  // Règle J-90 recopiée d'AddNoveltyButton : verrouillé à plus de 90 jours,
  // ouvert de J-90 au dernier jour inclus, masqué après la fin.
  const start = toDayString(event.date_debut);
  const isPreLaunch = start ? diffCalendarDays(todayString(), start) > NOVELTY_OPEN_DAYS_BEFORE : false;

  return {
    temporalState,
    isPast: past,
    canPrepareVisit: exhibitorCount >= PARCOURS_IA_MIN_EXHIBITORS && !past,
    canPublishNovelty: !past && !isPreLaunch,
    showRadarCrm: exhibitorCount > 0 && !past,
    showExhibitorSection: exhibitorCount > 0,
    durationDays: getEventDurationDays(event.date_debut, event.date_fin),
    affluenceValue: parseAffluence(event.affluence ?? null),
  };
}

/**
 * Le champ events.tarif n'est jamais NULL mais contient souvent des valeurs
 * non informatives ("Voir site internet", "non communiqué", "A venir"…).
 * Renvoie true uniquement si la valeur apporte une information tarifaire.
 */
export function isTarifDisplayable(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const normalized = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!normalized) return false;
  if (normalized.startsWith('voir ')) return false;
  const blocked = new Set(['non communique', 'nc', 'n/a', 'na', 'a venir', 'inconnu', '-', '—']);
  return !blocked.has(normalized);
}
