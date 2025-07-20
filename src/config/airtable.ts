
/**
 * Configuration centrale Airtable
 * Partagée entre client et serveur pour éviter les doublons
 */

export const AIRTABLE_CONFIG = {
  BASE_ID: 'SLxgKrY3BSA1nX',
  TABLES: {
    EVENTS: 'All_Events',
    EXHIBITORS: 'All_Exposants', 
    PARTICIPATION: 'Participation'
  }
} as const;

// Export des constantes individuelles pour compatibilité
export const AIRTABLE_BASE_ID = AIRTABLE_CONFIG.BASE_ID;
export const EVENTS_TABLE_NAME = AIRTABLE_CONFIG.TABLES.EVENTS;
export const EXHIBITORS_TABLE_NAME = AIRTABLE_CONFIG.TABLES.EXHIBITORS;
export const PARTICIPATION_TABLE_NAME = AIRTABLE_CONFIG.TABLES.PARTICIPATION;
