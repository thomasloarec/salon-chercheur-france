
import type { Sector } from './sector';

export type EventType = 'salon' | 'convention' | 'congres' | 'conference' | 'ceremonie';

export interface Event {
  id: string;
  id_event?: string;
  name_event: string;
  description_event?: string;
  date_debut: string;
  date_fin: string;
  secteur: string;
  nom_lieu?: string;
  ville: string;
  region?: string;
  country?: string;
  url_image?: string;
  url_site_officiel?: string;
  tags?: string[];
  tarif?: string;
  affluence?: number;
  estimated_exhibitors?: number;
  is_b2b: boolean;
  type_event: EventType;
  created_at: string;
  updated_at: string;
  last_scraped_at?: string;
  scraped_from?: string;
  rue?: string;
  code_postal?: string;
  visible?: boolean;
  slug?: string;
  sectors?: Sector[];
  is_favorite?: boolean;
}

export interface LocationSuggestion {
  type: 'department' | 'region' | 'city' | 'text';
  value: string;
  label: string;
}

export interface SearchFilters {
  query?: string;
  sector?: string;
  sectors?: string[];
  sectorIds?: string[];
  types?: string[];
  months?: number[];
  city?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
  minVisitors?: number;
  maxVisitors?: number;
  locationSuggestion?: LocationSuggestion;
}
