/**
 * Bannière de consentement cookies — sobre, premium, française.
 * Affichée tant qu'aucune décision n'a été prise.
 */
import { Button } from '@/components/ui/button';
import { useConsent } from '@/contexts/ConsentContext';
import { Cookie } from 'lucide-react';
import CookiePreferencesDialog from './CookiePreferencesDialog';

export default function CookieBanner() {
  const { needsDecision, isPreferencesOpen, acceptAll, rejectAll, openPreferences } = useConsent();

  if (!needsDecision && !isPreferencesOpen) return null;

  return (
    <>
      {needsDecision && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Consentement aux cookies"
          className="fixed bottom-0 left-0 right-0 z-[60] border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg"
        >
          <div className="mx-auto max-w-6xl px-4 py-4 md:py-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-foreground leading-relaxed">
                Nous utilisons des cookies pour assurer le bon fonctionnement du site, mesurer son
                audience et améliorer votre expérience. Vous pouvez accepter, refuser ou personnaliser
                vos choix à tout moment.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={rejectAll}>
                Tout refuser
              </Button>
              <Button variant="outline" size="sm" onClick={openPreferences}>
                Personnaliser
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Tout accepter
              </Button>
            </div>
          </div>
        </div>
      )}
      <CookiePreferencesDialog />
    </>
  );
}
