
/**
 * Configuration centrale Airtable
 * Partagée entre toutes les edge functions
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

/**
 * Fonction utilitaire pour lire les variables d'environnement avec fallback
 * Utilise d'abord la variable d'environnement, puis la config par défaut
 */
export function getEnvOrConfig(key: string): string {
  const envValue = Deno.env.get(key);
  if (envValue) return envValue;
  
  // Fallbacks vers la configuration
  switch (key) {
    case 'AIRTABLE_BASE_ID':
      return AIRTABLE_CONFIG.BASE_ID;
    case 'EVENTS_TABLE_NAME':
      return AIRTABLE_CONFIG.TABLES.EVENTS;
    case 'EXHIBITORS_TABLE_NAME':
      return AIRTABLE_CONFIG.TABLES.EXHIBITORS;
    case 'PARTICIPATION_TABLE_NAME':
      return AIRTABLE_CONFIG.TABLES.PARTICIPATION;
    default:
      return ''; // Pas de fallback pour les variables sensibles comme AIRTABLE_PAT
  }
}

/**
 * Vérifie quelles variables requises sont manquantes
 */
export function checkMissingVars(): string[] {
  const REQUIRED_VARS = [
    'AIRTABLE_PAT',
    'AIRTABLE_BASE_ID',
    'EVENTS_TABLE_NAME',
    'EXHIBITORS_TABLE_NAME',
    'PARTICIPATION_TABLE_NAME'
  ];

  return REQUIRED_VARS.filter(key => {
    const value = getEnvOrConfig(key);
    return !value || value.trim() === '';
  });
}
