/**
 * Type definitions for Airtable import operations
 */

export interface AirtableEventRecord {
  id: string;
  fields: {
    'id_event': string;
    'nom_event': string;
    'status_event': string;
    'type_event': string;
    'date_debut': string;
    'date_fin': string;
    'secteur': string;
    'url_image': string;
    'url_site_officiel': string;
    'description_event': string;
    'affluence': string;
    'tarif': string;
    'nom_lieu': string;
    'rue': string;
    'code_postal': string;
    'ville': string;
  };
}

export interface AirtableExposantRecord {
  id: string;
  fields: {
    'id_exposant': string;
    'nom_exposant': string;
    'website_exposant': string;
    'exposant_description': string;
  };
}

export interface AirtableParticipationRecord {
  id: string;
  fields: {
    'id_event_text': string;
    'urlexpo_event': string;
    'website_exposant': string;
    'stand_exposant': string;
    'nom_exposant': string;
  };
}

export interface ImportError {
  record_id: string;
  reason: string;
}

export interface EventImportResult {
  eventsImported: number;
  eventErrors: ImportError[];
}

export interface ExposantImportResult {
  exposantsImported: number;
  exposantErrors: ImportError[];
}

export interface ParticipationImportResult {
  participationsImported: number;
  participationErrors: ImportError[];
}

export interface AirtableConfig {
  pat: string;
  baseId: string;
}

export interface AirtableResponse<T> {
  records: T[];
  offset?: string;
}