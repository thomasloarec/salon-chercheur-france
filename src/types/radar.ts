/**
 * Types partagés du Radar CRM.
 * Déplacés depuis `src/pages/RadarCrmResults.tsx` sans aucune modification de définition,
 * pour être importables par le contexte, la page et le menu latéral.
 */

export type Import = {
  id: string;
  file_name: string | null;
  status: string;
  total_rows: number | null;
  matched_companies_count: number | null;
  unmatched_companies_count: number | null;
  created_at: string;
};

export type Company = {
  id: string;
  company_name: string;
  website_raw: string | null;
  normalized_domain: string | null;
};

/**
 * Shape returned by the server-side RPC `get_my_radar_view`.
 * Defined locally because the RPC is typed as `Json` in the generated Supabase types.
 */
export type RadarStatus = 'paid' | 'beta' | 'trial_active' | 'trial_expired' | 'free' | 'none';

/** Per-account watch preference (P1-c triage). */
export type Pref = 'starred' | 'ignored' | 'normal';

export interface RadarViewCompany {
  crm_company_id: string;
  company_name: string | null;
  website_raw: string | null;
  normalized_domain: string | null;
  id_exposant: string | null;
  nom_exposant: string | null;
  stand_exposants_list: string | null;
  needs_review: boolean | null;
  name_similarity: number | null;
  pref_status: Pref | null;
}

export interface RadarViewEvent {
  event_id: string;
  nom_event: string | null;
  slug: string | null;
  url_image: string | null;
  type_event: string | null;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  nom_lieu: string | null;
  days_until_event: number | null;
  is_future_event: boolean | null;
  company_count: number;
  companies: RadarViewCompany[];
}

export interface RadarView {
  has_access: boolean;
  status: RadarStatus;
  days_left: number | null;
  import_id: string | null;
  summary: {
    companies_analyzed: number;
    companies_detected: number;
    future_companies: number;
    future_salons: number;
    future_participations: number;
    starred?: number;
    ignored?: number;
  };
  events: RadarViewEvent[];
}

/**
 * Per-member seat access (RPC `my_radar_access`, already in prod).
 * access_kind pilote l'affichage : bandeau d'essai, blocage propre ou accès normal.
 */
export type RadarAccessKind = 'paid' | 'trial' | 'beta' | 'locked' | 'none';
export interface RadarAccess {
  account_id: string | null;
  access_kind: RadarAccessKind;
  has_access: boolean;
  trial_ends_at: string | null;
  trial_days_left: number | null;
  paid_seats: number | null;
}

/** Aggregated event with all CRM matches */
export interface EventGroup {
  event_id: string;
  slug: string | null;
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  ville: string | null;
  nom_lieu: string | null;
  url_image: string | null;
  days_until: number | null;
  is_future: boolean;
  company_count: number;
  companies: Array<{
    company: Company;
    id_exposant: string;
    nom_exposant: string | null;
    stand: string | null;
    needs_review: boolean;
    name_similarity: number | null;
    pref_status: Pref | null;
  }>;
}

/** Map a RPC event payload to the existing EventGroup shape used by all cards. */
export const mapEventToGroup = (e: RadarViewEvent): EventGroup => ({
  event_id: e.event_id,
  slug: e.slug,
  nom_event: e.nom_event ?? 'Événement',
  date_debut: e.date_debut,
  date_fin: e.date_fin,
  ville: e.ville,
  nom_lieu: e.nom_lieu,
  url_image: e.url_image,
  days_until: e.days_until_event,
  is_future: e.is_future_event ?? false,
  company_count: e.company_count,
  companies: (e.companies ?? []).map((c) => ({
    company: {
      id: c.crm_company_id,
      company_name: c.company_name ?? '',
      website_raw: c.website_raw,
      normalized_domain: c.normalized_domain,
    },
    id_exposant: c.id_exposant ?? '',
    nom_exposant: c.nom_exposant,
    stand: c.stand_exposants_list,
    needs_review: c.needs_review === true,
    name_similarity: c.name_similarity ?? null,
    pref_status: c.pref_status ?? null,
  })),
});
