/**
 * Helpers Google Tag (gtag.js) + Google Analytics 4 + Consent Mode v2
 *
 * Pourquoi un fichier dédié :
 * - centralise toutes les interactions avec window.gtag / window.dataLayer
 * - rend le reste du code testable et défensif
 * - garantit que rien ne casse si GA4 ne charge pas (réseau bloqué, adblock…)
 */
import type { ConsentState, GoogleConsentParams } from './types';

/**
 * Measurement ID GA4 lu depuis l'environnement.
 * - PROD : doit impérativement être défini via VITE_GA4_MEASUREMENT_ID
 * - DEV  : fallback sur l'ID de dev pour ne pas bloquer le développement local
 */
const ENV_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
const DEV_FALLBACK_ID = 'G-JLYJ9NSWRF';

export const GA4_MEASUREMENT_ID: string =
  ENV_ID && ENV_ID.trim().length > 0
    ? ENV_ID.trim()
    : import.meta.env.DEV
      ? DEV_FALLBACK_ID
      : '';

if (!ENV_ID && import.meta.env.PROD) {
  // En prod, on log un avertissement plutôt que de crasher : GA4 sera simplement désactivé.
  console.warn(
    '[GA4] VITE_GA4_MEASUREMENT_ID non défini — analytics désactivé en production.',
  );
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

/**
 * Garantit que window.gtag et window.dataLayer existent.
 * Doit être appelé avant tout gtag(...) — y compris avant le chargement du script externe.
 * Le script dans index.html fait déjà ça côté head, ce helper est une ceinture de sécurité côté JS.
 */
export function ensureGtag(): void {
  if (typeof window === 'undefined') return;
  if (!window.dataLayer) window.dataLayer = [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }
}

/** Convertit notre ConsentState vers les paramètres Google Consent Mode v2 */
export function toGoogleConsent(state: ConsentState): GoogleConsentParams {
  return {
    analytics_storage: state.analytics ? 'granted' : 'denied',
    ad_storage: state.marketing ? 'granted' : 'denied',
    ad_user_data: state.marketing ? 'granted' : 'denied',
    ad_personalization: state.marketing ? 'granted' : 'denied',
    functionality_storage: 'granted', // nécessaire
    security_storage: 'granted', // nécessaire
  };
}

/** Met à jour le consentement Google */
export function updateGoogleConsent(state: ConsentState): void {
  ensureGtag();
  const params = toGoogleConsent(state);
  window.gtag('consent', 'update', params);
  if (import.meta.env.DEV) {
    console.log('[Consent] gtag consent update →', params);
  }
}

let ga4Loaded = false;
let ga4Configured = false;

/**
 * Charge le script gtag.js si pas déjà fait, puis configure GA4.
 * - idempotent
 * - send_page_view désactivé (on gère manuellement les page_view en SPA)
 * - non bloquant : si le script échoue, le site continue normalement
 */
export function loadGA4(): void {
  if (typeof window === 'undefined') return;
  if (ga4Configured) return;
  if (!GA4_MEASUREMENT_ID) {
    if (import.meta.env.DEV) {
      console.warn('[GA4] Aucun Measurement ID — chargement ignoré');
    }
    return;
  }
  ensureGtag();

  if (!ga4Loaded) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
    script.onerror = () => {
      console.warn('[GA4] Script failed to load — analytics disabled');
    };
    document.head.appendChild(script);
    ga4Loaded = true;
  }

  window.gtag('js', new Date());
  window.gtag('config', GA4_MEASUREMENT_ID, {
    send_page_view: false, // SPA : on envoie les page_view manuellement
    anonymize_ip: true,
  });
  ga4Configured = true;

  if (import.meta.env.DEV) {
    console.log('[GA4] Configured', GA4_MEASUREMENT_ID);
  }
}

/** Envoie un événement page_view (SPA) */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: title ?? document.title,
  });
  if (import.meta.env.DEV) {
    console.log('[GA4] page_view', path);
  }
}

/** Envoie un évènement personnalisé */
export function trackEvent(name: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params ?? {});
  if (import.meta.env.DEV) {
    console.log('[GA4] event', name, params);
  }
}
