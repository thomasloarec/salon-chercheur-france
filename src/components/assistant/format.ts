import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AssistantItem } from './types';

const TYPE_LABELS: Record<string, string> = {
  conference: 'Conférence',
  table_ronde: 'Table ronde',
  atelier: 'Atelier',
  keynote: 'Keynote',
  demo: 'Démonstration',
  networking: 'Networking',
  remise_prix: 'Remise de prix',
};

export function sessionTypeLabel(t: string | null | undefined): string {
  return (t && TYPE_LABELS[t]) || 'Programme';
}

/** « mer. 2 déc. », sans l'année (certaines dates importées ont une année fausse). */
export function dayLabel(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return format(parseISO(d), 'EEE d MMM', { locale: fr });
  } catch {
    return '';
  }
}

export function timeLabel(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '';
}

export function countLabel(items: AssistantItem[]): string {
  const s = items.filter((i) => i.item_type === 'session').length;
  const n = items.filter((i) => i.item_type === 'novelty').length;
  const parts: string[] = [];
  if (s) parts.push(`${s} ${s > 1 ? 'conférences' : 'conférence'}`);
  if (n) parts.push(`${n} ${n > 1 ? 'Nouveautés' : 'Nouveauté'}`);
  if (!parts.length) return '';
  return `${parts.join(' et ')} à ne pas manquer`;
}

export function daysUntil(dateDebut: string, dateFin?: string | null): string {
  const today = new Date();
  const start = parseISO(dateDebut);
  const end = dateFin ? parseISO(dateFin) : start;
  const diff = differenceInCalendarDays(start, today);
  if (diff <= 0 && differenceInCalendarDays(end, today) >= 0) {
    return diff === 0 ? "Aujourd'hui" : 'En cours';
  }
  if (diff === 1) return 'Demain';
  if (diff > 1) return `Dans ${diff} jours`;
  return 'Terminé';
}
