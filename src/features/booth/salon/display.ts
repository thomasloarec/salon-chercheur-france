import type { Contact } from '@/lib/booth/types';

type C = Partial<Pick<Contact, 'first_name' | 'last_name' | 'company_name' | 'job_title' | 'email' | 'phone'>> | null | undefined;

const person = (c: C) => (c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '');

/** Entreprise d'abord, puis la personne, puis ses coordonnées. */
export function primaryLabel(c: C) {
  return c?.company_name?.trim() || person(c) || c?.email || c?.phone || 'Contact sans nom';
}

export function secondaryLabel(c: C) {
  if (!c) return '';
  if (c.company_name?.trim()) return [person(c), c.job_title].filter(Boolean).join(' · ');
  return c.job_title ?? '';
}

/** « Entreprise · Prénom » pour les en-têtes du parcours. */
export function headLabel(company: string, name: string) {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return [company.trim(), first].filter(Boolean).join(' · ');
}

/* ---------- Journées du salon ---------- */

export function ymdInTz(iso: string, tz: string | null | undefined) {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  }
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

export interface SalonDay {
  key: string; // ymd
  short: string; // « Jour 2 » ou « avant le salon »
  order: number;
}

export function salonDay(iso: string, ws: { date_debut: string | null; date_fin: string | null; timezone: string | null }): SalonDay {
  const key = ymdInTz(iso, ws.timezone);
  const start = ws.date_debut?.slice(0, 10);
  const end = ws.date_fin?.slice(0, 10);
  if (!start) return { key, short: '', order: 0 };
  const n = dayDiff(key, start);
  if (n < 0) return { key, short: 'avant le salon', order: n };
  if (end && dayDiff(key, end) > 0) return { key, short: 'après le salon', order: n };
  return { key, short: `Jour ${n + 1}`, order: n };
}

const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('fr-FR', { ...opts, timeZone: 'UTC' });

export const shortDate = (ymd: string) => fmt(ymd, { weekday: 'short', day: 'numeric', month: 'short' });
export const longDate = (ymd: string) => fmt(ymd, { weekday: 'long', day: 'numeric', month: 'long' });

export function timeInTz(iso: string, tz: string | null | undefined) {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz || undefined });
  } catch {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}

/** « Jour 2 · sam. 25 oct. · 10:12 » */
export function dayTimeLabel(iso: string, ws: { date_debut: string | null; date_fin: string | null; timezone: string | null }) {
  const d = salonDay(iso, ws);
  return [d.short, shortDate(d.key), timeInTz(iso, ws.timezone)].filter(Boolean).join(' · ');
}

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
