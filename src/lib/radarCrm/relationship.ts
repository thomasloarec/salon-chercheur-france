/**
 * Radar CRM — statut relationnel par compte (front only).
 *
 * Backend déjà déployé :
 *  - Écriture : rpc('set_radar_company_relationship', { p_crm_company_id, p_status })
 *  - Lecture  : from('radar_company_relationship').select('company_key, relationship_status')
 *
 * MAPPING compte → statut (reproduction EXACTE de la définition SQL) :
 *   companyKey = (normalized_domain || '').trim().toLowerCase()
 *             || (company_name || '').trim().toLowerCase()
 */

export type RelationshipStatus =
  | 'client_actif'
  | 'client_dormant'
  | 'prospect_chaud'
  | 'prospect_froid'
  | 'ancien_client'
  | 'a_qualifier';

/** Ordre d'affichage dans le sélecteur. */
export const RELATIONSHIP_ORDER: RelationshipStatus[] = [
  'client_actif',
  'client_dormant',
  'prospect_chaud',
  'prospect_froid',
  'ancien_client',
  'a_qualifier',
];

/** Statut par défaut (null et 'a_qualifier' traités de façon identique). */
export const DEFAULT_RELATIONSHIP: RelationshipStatus = 'a_qualifier';

interface RelationshipMeta {
  label: string;
  /** Classe de la couleur du texte du libellé (toujours neutre pour rester lisible). */
  badge: string;
  /** Classe de la pastille de couleur (point 8px). Désaturée, sauf « à qualifier » (orange = action). */
  dot: string;
}

/**
 * Doctrine visuelle (RUN 7) :
 *  - Le LIBELLÉ est toujours en texte neutre foncé (foreground), jamais en couleur sur fond coloré.
 *  - L'ORANGE (accent) est réservé à « à qualifier » = état qui attend une action.
 *  - Les 5 autres statuts « réglés » = point désaturé/atténué, discret. Pas de couleurs vives.
 */
export const RELATIONSHIP_META: Record<RelationshipStatus, RelationshipMeta> = {
  client_actif: {
    label: 'Client actif',
    badge: 'text-foreground',
    dot: 'bg-emerald-600/60',
  },
  client_dormant: {
    label: 'Client dormant',
    badge: 'text-foreground',
    dot: 'bg-stone-400',
  },
  prospect_chaud: {
    label: 'Prospect chaud',
    badge: 'text-foreground',
    dot: 'bg-primary/70',
  },
  prospect_froid: {
    label: 'Prospect froid',
    badge: 'text-foreground',
    dot: 'bg-sky-400/60',
  },
  ancien_client: {
    label: 'Ancien client',
    badge: 'text-foreground',
    dot: 'bg-slate-300',
  },
  a_qualifier: {
    label: 'À qualifier',
    badge: 'text-foreground',
    dot: 'bg-accent',
  },
};

/** Clé de compte — reproduit EXACTEMENT la règle SQL. */
export const companyKeyFor = (
  normalizedDomain: string | null | undefined,
  companyName: string | null | undefined,
): string =>
  (normalizedDomain ?? '').trim().toLowerCase()
  || (companyName ?? '').trim().toLowerCase();

/** Normalise null → 'a_qualifier'. */
export const normalizeRelationship = (
  s: string | null | undefined,
): RelationshipStatus =>
  (s && (RELATIONSHIP_ORDER as string[]).includes(s))
    ? (s as RelationshipStatus)
    : DEFAULT_RELATIONSHIP;
