
import type { Sector } from './sector';

export type EventType = 'salon' | 'convention' | 'congres' | 'conference' | 'ceremonie';

export interface Event {
  id: string;
  id_event?: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  sector: string;
  location: string;
  city: string;
  region?: string;
  country?: string;
  venue_name?: string;
  event_url?: string;
  website_url?: string;
  image_url?: string;
  tags?: string[];
  organizer_name?: string;
  organizer_contact?: string;
  entry_fee?: string;
  estimated_visitors?: number;
  estimated_exhibitors?: number;
  is_b2b: boolean;
  event_type: EventType;
  created_at: string;
  updated_at: string;
  last_scraped_at?: string;
  scraped_from?: string;
  address?: string;
  postal_code?: string;
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
