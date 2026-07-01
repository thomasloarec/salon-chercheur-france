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
  /** Classes du badge (dot + texte + fond). */
  badge: string;
  /** Classe de la pastille de couleur. */
  dot: string;
}

export const RELATIONSHIP_META: Record<RelationshipStatus, RelationshipMeta> = {
  client_actif: {
    label: 'Client actif',
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  client_dormant: {
    label: 'Client dormant',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  prospect_chaud: {
    label: 'Prospect chaud',
    badge: 'bg-accent/15 text-accent border-accent/30',
    dot: 'bg-accent',
  },
  prospect_froid: {
    label: 'Prospect froid',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  ancien_client: {
    label: 'Ancien client',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
  a_qualifier: {
    label: 'À qualifier',
    badge: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/50',
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
