
export interface Event {
  id: string; // UUID primary key from database - USED for exhibitors relations
  id_event?: string; // Legacy database logical event ID (ex: Event_6) - DEPRECATED
  nom_event: string;
  description_event?: string;
  date_debut: string;
  date_fin?: string;
  secteur?: string;
  nom_lieu?: string;
  ville?: string;
  country?: string;
  url_image?: string; // Keep existing field name for compatibility
  url_site_officiel?: string;
  tags?: string[];
  tarif?: string;
  affluence?: string; // Changed from number to string to match database
  estimated_exhibitors?: number;
  is_b2b?: boolean;
  type_event?: 'salon' | 'conference' | 'convention' | 'exposition' | 'congres' | 'forum' | 'autre';
  created_at?: string;
  updated_at?: string;
  last_scraped_at?: string;
  scraped_from?: string;
  rue?: string;
  code_postal?: string;
  visible?: boolean;
  slug?: string;
  sectors?: {
    id: string;
    name: string;
    created_at: string;
  }[];
  is_favorite?: boolean;
}

// Export EventType for backwards compatibility
export type EventType = Event['type_event'];

export interface SearchFilters {
  query?: string;
  sectors?: string[];
  sectorIds?: string[];
  types?: string[];
  months?: number[];
  city?: string;
  // Region filtering now handled via locationSuggestion
  dateDebut?: string;
  dateFin?: string;
  minVisitors?: number;
  maxVisitors?: number;
  locationSuggestion?: {
    type: 'city' | 'region' | 'department' | 'text';
    value: string;
    label: string;
  };
}

export interface LocationSuggestion {
  rank: number;
  type: 'city' | 'region' | 'department';
  label: string;
  value: string;
}
