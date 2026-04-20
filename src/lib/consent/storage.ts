/**
 * Persistance locale du consentement cookies
 */
import { CONSENT_STORAGE_KEY, CONSENT_VERSION, type ConsentState, type StoredConsent } from './types';

export function loadConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    // Invalider si schéma changé
    if (parsed.version !== CONSENT_VERSION) return null;
    if (!parsed.state || typeof parsed.state.analytics !== 'boolean') return null;
    return parsed;
  } catch (err) {
    console.warn('[Consent] Failed to read storage', err);
    return null;
  }
}

export function saveConsent(state: ConsentState): StoredConsent {
  const stored: StoredConsent = {
    state,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored));
  } catch (err) {
    console.warn('[Consent] Failed to persist', err);
  }
  return stored;
}

export function clearConsent(): void {
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
