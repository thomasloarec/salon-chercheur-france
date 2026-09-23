import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/** 'YYYY-MM-DD' lu en date locale (évite le décalage d'un jour lié au fuseau). */
export function parseLocalDate(value?: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Jours du salon, bornés à 7 (au-delà, le choix du jour n'aide plus le visiteur). */
export function eventDays(debut?: string | null, fin?: string | null): Date[] {
  const start = parseLocalDate(debut);
  if (!start) return [];
  const end = parseLocalDate(fin) ?? start;
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end && days.length < 7) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** « Mar. 7 oct. » */
export function dayChipLabel(d: Date): string {
  return cap(format(d, 'EEE d MMM', { locale: fr }));
}

/** « du 7 au 9 octobre 2026 » ou « le 7 octobre 2026 » */
export function dateRangeLabel(debut?: string | null, fin?: string | null): string {
  const start = parseLocalDate(debut);
  if (!start) return '';
  const end = parseLocalDate(fin);
  if (!end || end.getTime() === start.getTime()) {
    return `le ${format(start, 'd MMMM yyyy', { locale: fr })}`;
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `du ${format(start, 'd', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`
    : `du ${format(start, 'd MMMM', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;
}
