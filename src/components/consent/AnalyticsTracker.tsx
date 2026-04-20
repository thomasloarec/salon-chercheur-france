/**
 * Émet un page_view GA4 à chaque changement de route (SPA).
 * Ne fait rien tant que analytics_storage n'est pas accordé (Consent Mode v2 bloque l'envoi).
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/consent/gtag';

export default function AnalyticsTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname + location.search;
    // évite les doublons (StrictMode, re-renders)
    if (lastPath.current === path) return;
    lastPath.current = path;
    // léger délai pour laisser document.title se mettre à jour
    const id = window.setTimeout(() => trackPageView(path), 0);
    return () => window.clearTimeout(id);
  }, [location.pathname, location.search]);

  return null;
}
