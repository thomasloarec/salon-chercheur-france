import type { Interaction, Opportunity } from '@/lib/booth/types';
import type { BoothCache } from '../sync/cache';

export const RELATIONSHIP: Record<Interaction['relationship'], string> = {
  new_prospect: 'Nouveau prospect',
  customer: 'Client',
  partner: 'Partenaire',
  other: 'Autre',
};
export const POTENTIAL: Record<NonNullable<Interaction['potential']>, string> = {
  hot: 'Chaud',
  good: 'Intéressant',
  explore: 'À creuser',
  none: 'Pas de potentiel',
};
export const TOPIC: Record<NonNullable<Interaction['customer_topic']>, string> = {
  new_project: 'Nouveau projet',
  existing_business: 'Suivi en cours',
  relationship: 'Relationnel',
};
export const ACTION: Record<Interaction['next_action'], string> = {
  call: 'Rappeler',
  send_doc: 'Envoyer une doc',
  quote: 'Devis',
  meeting: 'Rendez-vous',
  email: 'Email',
  other: 'Autre',
  none: 'Rien',
};
export const VALUE_BAND: Record<NonNullable<Opportunity['value_band']>, string> = {
  lt5k: 'Moins de 5 k€',
  '5_20k': '5 à 20 k€',
  '20_50k': '20 à 50 k€',
  '50_100k': '50 à 100 k€',
  gt100k: 'Plus de 100 k€',
};
export const HORIZON: Record<NonNullable<Opportunity['horizon']>, string> = {
  lt3m: 'Moins de 3 mois',
  '3_6m': '3 à 6 mois',
  '6_12m': '6 à 12 mois',
  gt12m: 'Plus de 12 mois',
};

export const POTENTIAL_CLASS: Record<string, string> = {
  hot: 'bg-destructive/15 text-destructive',
  good: 'bg-primary/15 text-primary',
  explore: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  none: 'bg-muted text-muted-foreground',
};

/** Les rencontres créées sur l'appareil n'ont pas encore de statut ni de responsable côté serveur. */
export const isCompleted = (i: Interaction) => (i.status ?? 'completed') === 'completed';
export const ownerOf = (i: Interaction, me: string) => i.owner_user_id ?? i.created_by ?? me;

export function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: null, last_name: null };
  if (parts.length === 1) return { first_name: null, last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

export const fullName = (c: { first_name?: string | null; last_name?: string | null } | null | undefined) =>
  c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : '';

export function normPhone(p: string | null | undefined) {
  let d = (p ?? '').replace(/\D/g, '');
  if (d.startsWith('0033')) d = d.slice(4);
  else if (d.startsWith('33') && d.length === 11) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d;
}

export function teammateName(cache: BoothCache, userId: string | null | undefined, me: string, firstOnly = true) {
  if (!userId) return '';
  if (userId === me) return 'vous';
  const t = cache.team.find((m) => m.user_id === userId);
  const n = t?.name || t?.email || 'un collègue';
  return firstOnly ? n.split(/\s+/)[0] : n;
}

export function initials(cache: BoothCache, userId: string) {
  const t = cache.team.find((m) => m.user_id === userId);
  const n = (t?.name || t?.email || '?').trim();
  const p = n.split(/[\s@.]+/).filter(Boolean);
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase();
}

export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
};

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
