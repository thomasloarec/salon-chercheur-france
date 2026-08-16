/**
 * Utilitaires de semaines ISO 8601 pour la vue calendrier du Radar CRM.
 * Aucune dépendance externe. Les dates de la base sont manipulées en chaînes
 * `YYYY-MM-DD` : on ne construit jamais un Date à partir d'une chaîne brute
 * (interprétée en UTC, ce qui décale d'un jour), toujours via ses composants.
 */

/** Parse une date base (`YYYY-MM-DD` ou ISO tronquée) en Date locale, sans décalage. */
export function parseYmd(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Formate une Date locale en `YYYY-MM-DD`. */
export function toYmd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + n);
  return next;
}

/** Numéro de semaine ISO 8601 (semaine du lundi, semaine 1 = celle du 1er jeudi). */
export function isoWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Année ISO associée à la semaine (peut différer de l'année civile fin/début d'année). */
export function isoWeekYear(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return t.getUTCFullYear();
}

/** Lundi (00:00 local) de la semaine contenant `d`. */
export function mondayOf(d: Date): Date {
  const day = d.getDay() || 7; // 1 = lundi … 7 = dimanche
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 1 - day);
}

/** Clé de semaine stable, basée sur l'année ISO : `2026-W35`. */
export function weekKey(d: Date): string {
  return `${isoWeekYear(d)}-W${String(isoWeekNumber(d)).padStart(2, '0')}`;
}

/** Indice du jour dans la semaine ISO : 0 = lundi … 6 = dimanche. */
export function isoDayIndex(d: Date): number {
  return (d.getDay() || 7) - 1;
}

/** Nombre de jours entiers entre deux dates locales (a - b). */
export function diffDays(a: Date, b: Date): number {
  const ms = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
    - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round(ms / 86400000);
}

const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' });
const DAY_MONTH_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const MONTH_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

/** Plage courte d'une semaine : « 24 au 30 » (ou « 29 sept. au 5 oct. » à cheval). */
export function weekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  if (monday.getMonth() === sunday.getMonth()) {
    return `${DAY_FMT.format(monday)} au ${DAY_FMT.format(sunday)}`;
  }
  return `${DAY_MONTH_FMT.format(monday)} au ${DAY_MONTH_FMT.format(sunday)}`;
}

export function monthLabel(d: Date): string {
  const s = MONTH_YEAR_FMT.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dayMonthLabel(d: Date): string {
  return DAY_MONTH_FMT.format(d);
}
