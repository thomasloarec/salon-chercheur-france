/**
 * Le Fil du Salon — constantes partagées.
 *
 * Ce module est consommé par l'espace organisateur (lot 4) ET par la page
 * salon publique (lot 5). Les libellés des CTA internes sont définis ICI et
 * nulle part ailleurs : la base interdit à un organisateur de fournir son
 * propre libellé sur un lien interne (contrainte
 * event_updates_cta_label_iff_external), précisément pour qu'il ne puisse pas
 * écrire « Réserver ma place » sur une ancre qui mène à sa propre page.
 */

export const FEED_CATEGORIES = [
  { value: 'programme',   label: 'Programme' },
  { value: 'intervenant', label: 'Intervenant' },
  { value: 'exposants',   label: 'Exposants' },
  { value: 'billetterie', label: 'Billetterie' },
  { value: 'exposer',     label: 'Exposer' },
  { value: 'pratique',    label: 'Infos pratiques' },
  { value: 'autre',       label: 'Autre' },
] as const;

export type FeedCategory = (typeof FEED_CATEGORIES)[number]['value'];

export const FEED_CTA_TYPES = [
  { value: 'none',       label: 'Aucun bouton' },
  { value: 'programme',  label: 'Vers le programme' },
  { value: 'exposants',  label: 'Vers les exposants' },
  { value: 'nouveautes', label: 'Vers les nouveautés' },
  { value: 'external',   label: 'Vers un lien externe' },
] as const;

export type FeedCtaType = (typeof FEED_CTA_TYPES)[number]['value'];

/** Libellé et ancre imposés pour chaque CTA interne. */
export const INTERNAL_CTA: Record<
  Exclude<FeedCtaType, 'none' | 'external'>,
  { label: string; anchor: string }
> = {
  programme:  { label: 'Voir le programme',   anchor: '#programme' },
  exposants:  { label: 'Voir les exposants',  anchor: '#exposants' },
  nouveautes: { label: 'Voir les nouveautés', anchor: '#nouveautes' },
};

export const FEED_MESSAGE_MAX = 220;
export const FEED_CTA_LABEL_MAX = 40;

export function categoryLabel(value: string): string {
  return FEED_CATEGORIES.find((c) => c.value === value)?.label ?? 'Autre';
}
