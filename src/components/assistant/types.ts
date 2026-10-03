export type AssistantItemType = 'session' | 'novelty';

export interface AssistantItem {
  match_id: string;
  item_type: AssistantItemType;
  item_id: string;
  event_id: string;
  score: number | null;
  reason: string | null;            // « Pourquoi pour vous » ; peut être null
  title: string | null;
  promise: string | null;           // une ligne : ce qu'on y apprend / voit
  kept: boolean;                    // déjà ajoutée à l'agenda (ou inscription / rendez-vous)
  subject_label: string | null;     // libellé court de la piste : « Pas ce sujet (…) »
  sector: { id: string; name: string } | null; // secteur à nommer : « Pas mon secteur (…) » ; null = bouton masqué
  session: null | {
    session_type: string | null;    // conference, table_ronde, atelier, keynote, demo, networking, remise_prix, autre
    day_date: string | null;        // 'YYYY-MM-DD'
    start_time: string | null;      // 'HH:MM:SS'
    end_time: string | null;
    location: string | null;
    registration_url: string | null;
  };
  novelty: null | {
    slug: string | null;
    stand_info: string | null;
    exhibitor_id: string | null;
    exhibitor_name: string | null;
    image_url: string | null;
    exhibitor_slug: string | null;
    can_request_meeting: boolean;
  };
}

export interface AssistantEvent {
  id: string; slug: string; nom_event: string; date_debut: string; date_fin: string;
  ville: string | null; nom_lieu: string | null; url_image: string | null;
}

export interface AssistantSuggestion {
  event: AssistantEvent;
  status: 'pending' | 'notified' | 'seen';
  pepite_count: number;
  best_score: number | null;
  pepites: AssistantItem[];         // nom technique du champ ; ne jamais l'afficher
}

export interface AssistantFeed {
  has_profile: boolean;
  profile?: {
    id: string; label: string | null; company_name: string | null; company_ref: string | null;
    sub_sector_ids: string[]; role_code: string | null; interests: string[]; goals: string[];
    city: string | null; radius_km: number | null; onboarded_at: string | null;
    company_description?: string | null; region_codes?: string[]; email_alerts_opt_in?: boolean;
  };
  status?: { refreshing: boolean; refreshed_at: string | null };
  pistes?: { id: string; label: string; short_label: string }[];
  suggestions?: AssistantSuggestion[];          // « À découvrir »
  agenda_pepites?: { event_id: string; pepites: AssistantItem[] }[]; // salons déjà dans l'agenda
  kept_sessions?: {
    feedback_id: string; event_id: string; session_id: string; title: string; promise: string | null;
    day_date: string | null; start_time: string | null; end_time: string | null;
    location: string | null; registration_url: string | null;
  }[];
}

export type AssistantKeptSession = NonNullable<AssistantFeed['kept_sessions']>[number];
