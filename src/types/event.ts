
export interface Event {
  id: string;
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
  image_url?: string;
  tags?: string[];
  organizer_name?: string;
  organizer_contact?: string;
  entry_fee?: string;
  estimated_visitors?: number;
  estimated_exhibitors?: number;
  is_b2b: boolean;
  event_type?: string;
  created_at: string;
  updated_at: string;
  last_scraped_at?: string;
  scraped_from?: string;
  address?: string;
}

export interface SearchFilters {
  query?: string;
  sector?: string;
  sectors?: string[];
  types?: string[];
  months?: number[];
  city?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
  minVisitors?: number;
  maxVisitors?: number;
}
