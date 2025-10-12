/**
 * Unified LotExpo types for the Novelties feature
 * All components should import from this file to avoid type mismatches
 */

// Base types
export interface Exhibitor {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  owner_user_id?: string | null;
  plan: 'free' | 'paid';
  description?: string | null;
  website?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Participation {
  id: string;
  event_id: string;
  exhibitor_id: string;
  stand?: string | null;
  hall?: string | null;
}

export interface EventLite {
  id: string;
  slug: string;
  name: string;
  start_date: string;
  end_date: string;
  region_code?: string | null;
  type?: string | null;
  sector_tags?: string[] | null;
  city?: string | null;
  image_url?: string | null;
}

export type NoveltyType = 'Launch' | 'Prototype' | 'MajorUpdate' | 'LiveDemo' | 'Partnership' | 'Offer' | 'Talk';
export type NoveltyStatus = 'draft' | 'under_review' | 'published' | 'pending' | 'rejected';

export interface DemoSlot {
  start: string;
  end: string;
}

export interface Novelty {
  id: string;
  event_id: string;
  exhibitor_id: string;
  title: string;
  type: NoveltyType;
  reason_1?: string | null;
  reason_2?: string | null;
  reason_3?: string | null;
  audience_tags?: string[] | null;
  media_urls: string[]; // Always array, max 5
  doc_url?: string | null;
  availability?: string | null;
  stand_info: string; // Always required as string (never null)
  demo_slots?: DemoSlot[] | null;
  status: NoveltyStatus;
  created_at: string;
  updated_at: string;
}

export interface NoveltyStats {
  novelty_id: string;
  route_users_count: number;
  popularity_score: number;
  saves_count?: number;
  reminders_count?: number;
  updated_at?: string;
}

// Combined DTOs for API responses
export interface NoveltyDTO extends Novelty {
  exhibitor: Pick<Exhibitor, 'id' | 'name' | 'slug' | 'logo_url'>;
  participation?: Pick<Participation, 'stand' | 'hall'>;
  stats: NoveltyStats;
  event?: Pick<EventLite, 'id' | 'slug' | 'name' | 'city'>;
}

// For API responses with exhibitors by event
export interface EventExhibitorDTO {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  stand?: string | null;
  hall?: string | null;
  plan?: 'free' | 'paid';
}

// Form data interfaces
export interface AddNoveltyFormData {
  exhibitor_id: string;
  title: string;
  type: NoveltyType;
  reason_1: string;
  reason_2: string;
  reason_3: string;
  audience_tags: string[];
  media_urls: string[];
  doc_url: string;
  availability: string;
  stand_info: string;
  demo_slots: DemoSlot[] | null;
}

// Route management
export interface UserRoute {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string;
}

export interface RouteItem {
  id: string;
  route_id: string;
  novelty_id: string;
  created_at: string;
}

// API response types
export interface NoveltyListResponse {
  novelties: NoveltyDTO[];
  total: number;
  page: number;
  limit: number;
}

export interface TopNoveltiesResponse {
  novelties: NoveltyDTO[];
}

export interface EventExhibitorsResponse {
  exhibitors: EventExhibitorDTO[];
  total: number;
}

// API request types
export interface CreateNoveltyRequest {
  event_id: string;
  exhibitor_id: string;
  title: string;
  type: NoveltyType;
  reason_1?: string;
  reason_2?: string;
  reason_3?: string;
  audience_tags?: string[];
  media_urls?: string[];
  doc_url?: string;
  availability?: string;
  stand_info?: string;
  demo_slots?: DemoSlot[];
}

export interface RouteToggleRequest {
  novelty_id: string;
  action: 'add' | 'remove';
}

export interface ClaimExhibitorRequest {
  exhibitor_id: string;
  message?: string;
}

// Filter types for novelties
export interface NoveltyFilters {
  event_id?: string;
  sector_ids?: string[];
  types?: NoveltyType[];
  months?: number[];
  region_codes?: string[];
  sort?: 'popularity' | 'recent';
  limit?: number;
  offset?: number;
}

// Canonical Event type for UI consistency
export type CanonicalEvent = {
  id: string;
  title: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  type_code: string | null;
  secteur_labels: string[];
  ville: string | null;
  pays: string | null;
  visible: boolean | null;
  image_url: string | null; // UNIQUE source image pour tous les composants UI
  postal_code: string | null;
  // Champs additionnels pour compatibilité
  nom_event: string;
  date_debut: string | null;
  date_fin: string | null;
  secteur: any;
  nom_lieu: string | null;
  url_site_officiel: string | null;
  is_b2b: boolean;
  type_event: string | null;
  rue: string | null;
  code_postal: string | null;
};

// Constants
export const NOVELTY_TYPES: { value: NoveltyType; label: string }[] = [
  { value: 'Launch', label: 'Lancement' },
  { value: 'Prototype', label: 'Prototype' },
  { value: 'MajorUpdate', label: 'Mise à jour majeure' },
  { value: 'LiveDemo', label: 'Démo live' },
  { value: 'Partnership', label: 'Partenariat' },
  { value: 'Offer', label: 'Offre spéciale' },
  { value: 'Talk', label: 'Conférence' },
];

export const MAX_NOVELTY_IMAGES = 5;
export const HOVER_CYCLE_MS = 3000;