/**
 * ConsentContext — état global du consentement cookies + intégration Google Consent Mode v2
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ALL_GRANTED_STATE,
  DEFAULT_DENIED_STATE,
  type ConsentState,
} from '@/lib/consent/types';
import { loadConsent, saveConsent } from '@/lib/consent/storage';
import { ensureGtag, loadGA4, updateGoogleConsent } from '@/lib/consent/gtag';

interface ConsentContextValue {
  /** État actuel (persisté). null = aucune décision encore */
  consent: ConsentState | null;
  /** True tant que l'utilisateur n'a pas fait de choix */
  needsDecision: boolean;
  /** Ouvre le panneau de personnalisation */
  openPreferences: () => void;
  /** Ferme le panneau */
  closePreferences: () => void;
  isPreferencesOpen: boolean;
  /** Accepte tout */
  acceptAll: () => void;
  /** Refuse tout (sauf nécessaire) */
  rejectAll: () => void;
  /** Sauvegarde un choix personnalisé */
  savePreferences: (state: Omit<ConsentState, 'necessary'>) => void;
}

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [isPreferencesOpen, setPreferencesOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydratation au montage : applique le consentement persisté à Google
  useEffect(() => {
    ensureGtag();
    const stored = loadConsent();
    if (stored) {
      setConsent(stored.state);
      updateGoogleConsent(stored.state);
      if (stored.state.analytics) {
        loadGA4();
      }
    }
    setHydrated(true);
  }, []);

  const applyConsent = useCallback((next: ConsentState) => {
    saveConsent(next);
    setConsent(next);
    updateGoogleConsent(next);
    if (next.analytics) {
      loadGA4();
    }
  }, []);

  const acceptAll = useCallback(() => {
    applyConsent(ALL_GRANTED_STATE);
    setPreferencesOpen(false);
  }, [applyConsent]);

  const rejectAll = useCallback(() => {
    applyConsent(DEFAULT_DENIED_STATE);
    setPreferencesOpen(false);
  }, [applyConsent]);

  const savePreferences = useCallback(
    (state: Omit<ConsentState, 'necessary'>) => {
      applyConsent({ necessary: true, ...state });
      setPreferencesOpen(false);
    },
    [applyConsent],
  );

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      needsDecision: hydrated && consent === null,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
      isPreferencesOpen,
      acceptAll,
      rejectAll,
      savePreferences,
    }),
    [consent, hydrated, isPreferencesOpen, acceptAll, rejectAll, savePreferences],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within <ConsentProvider>');
  return ctx;
}
