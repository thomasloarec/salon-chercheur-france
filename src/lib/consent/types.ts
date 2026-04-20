/**
 * Types pour la gestion du consentement cookies (RGPD + Google Consent Mode v2)
 */

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export interface ConsentState {
  /** Cookies techniques nécessaires — toujours true */
  necessary: true;
  /** Mesure d'audience (GA4) */
  analytics: boolean;
  /** Cookies marketing / publicité */
  marketing: boolean;
}

export interface StoredConsent {
  state: ConsentState;
  /** ISO timestamp de la décision */
  timestamp: string;
  /** Version du schéma de consentement (pour invalider en cas de changement) */
  version: number;
}

/** Mapping vers Google Consent Mode v2 */
export interface GoogleConsentParams {
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
  analytics_storage: 'granted' | 'denied';
  functionality_storage: 'granted' | 'denied';
  security_storage: 'granted' | 'denied';
}

export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = 'lotexpo_cookie_consent';

export const DEFAULT_DENIED_STATE: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const ALL_GRANTED_STATE: ConsentState = {
  necessary: true,
  analytics: true,
  marketing: true,
};
