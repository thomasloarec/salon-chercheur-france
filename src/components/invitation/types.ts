/**
 * Données publiques d'une page d'invitation, telles que renvoyées par la RPC
 * get_invitation_page(p_slug). Une page inactive ne renvoie que le minimum.
 */
export interface InvitationStaff {
  first_name: string;
  last_name: string;
  job_title: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
}

export interface InvitationPageData {
  active: boolean;
  reason: 'ok' | 'not_found' | 'event_over' | 'novelty_unavailable';
  slug?: string;
  headline?: string | null;
  message?: string | null;
  exhibitor?: {
    id?: string;
    name: string;
    logo_url?: string | null;
    /** Repli favicon quand aucun logo n'est téléversé (lot 7). */
    website?: string | null;
    public_slug?: string | null;
  };
  event?: {
    id?: string;
    name: string;
    slug: string | null;
    date_debut?: string;
    date_fin?: string | null;
    ville?: string | null;
    nom_lieu?: string | null;
    url_image?: string | null;
  };
  stand?: string | null;
  novelty?: {
    title: string;
    type: string;
    summary: string | null;
    reasons: string[];
    url_image: string | null;
    slug: string | null;
  };
  staff?: InvitationStaff[];
}

export interface MeetingRequestInput {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  role: string;
  phone: string;
  notes: string;
  preferred_slot: string | null;
}

export type MeetingRequestResult = 'created' | 'duplicate' | 'inactive' | 'error';
