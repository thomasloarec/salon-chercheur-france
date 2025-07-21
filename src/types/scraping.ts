
export interface ScrapedEvent {
  title: string;
  description: string;
  dateDebut: Date;
  dateFin: Date | null;
  venue: string;
  websiteUrl: string;
  source: string;
  city: string;
  address: string;
  estimatedVisitors: number | null;
  estimatedExhibitors: number | null;
  entryFee: string | null;
  organizer: string;
  sector: string;
  tags: string[];
}

export interface ClassificationResult {
  isProfessional: boolean;
  professionalScore: number;
  sector: string;
  tags: string[];
  confidence: number;
}

export interface ScrapingResult {
  success: boolean;
  eventsFound: number;
  eventsProcessed: number;
  eventsSaved: number;
  errors: string[];
  source: string;
}
