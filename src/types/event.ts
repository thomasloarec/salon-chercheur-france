
export interface Event {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  sector: string;
  location: string;
  address?: string;
  city: string;
  region?: string;
  country: string;
  venue_name?: string;
  estimated_visitors?: number;
  estimated_exhibitors?: number;
  event_url?: string;
  image_url?: string;
  is_b2b: boolean;
  tags?: string[];
  organizer_name?: string;
  organizer_contact?: string;
  entry_fee?: string;
  created_at: string;
  updated_at: string;
  scraped_from?: string;
  last_scraped_at?: string;
  event_type?: 'salon' | 'convention' | 'congres' | 'conference' | 'ceremonie' | 'loisir' | 'inconnu';
}

export interface Sector {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  created_at: string;
}

export interface SearchFilters {
  query?: string;
  sector?: string;
  city?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
  minVisitors?: number;
  maxVisitors?: number;
}
