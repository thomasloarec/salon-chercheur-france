/**
 * Dialog de personnalisation fine — 3 catégories
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useConsent } from '@/contexts/ConsentContext';

export default function CookiePreferencesDialog() {
  const { isPreferencesOpen, closePreferences, consent, savePreferences, acceptAll, rejectAll } =
    useConsent();

  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  // À l'ouverture : si un choix existe déjà, le pré-charger ;
  // sinon (premier passage) tout coché par défaut, l'utilisateur retire ce qu'il refuse.
  useEffect(() => {
    if (isPreferencesOpen) {
      setAnalytics(consent?.analytics ?? true);
      setMarketing(consent?.marketing ?? true);
    }
  }, [isPreferencesOpen, consent]);

  return (
    <Dialog open={isPreferencesOpen} onOpenChange={(o) => !o && closePreferences()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Préférences cookies</DialogTitle>
          <DialogDescription>
            Choisissez les catégories de cookies que vous autorisez. Vous pouvez modifier ces choix à
            tout moment depuis le pied de page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nécessaires */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4 bg-muted/30">
            <div className="flex-1">
              <h4 className="font-medium text-sm">Cookies nécessaires</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Indispensables au fonctionnement du site (session, sécurité, préférences). Toujours
                actifs.
              </p>
            </div>
            <Switch checked disabled aria-label="Cookies nécessaires (toujours actifs)" />
          </div>

          {/* Analytics */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="flex-1">
              <h4 className="font-medium text-sm">Mesure d'audience</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Google Analytics 4 — nous aide à comprendre comment le site est utilisé pour
                l'améliorer. Données anonymisées.
              </p>
            </div>
            <Switch
              checked={analytics}
              onCheckedChange={setAnalytics}
              aria-label="Activer la mesure d'audience"
            />
          </div>

          {/* Marketing */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="flex-1">
              <h4 className="font-medium text-sm">Marketing</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Cookies publicitaires et de personnalisation. Aucun cookie marketing actif
                aujourd'hui — réservé à un usage futur.
              </p>
            </div>
            <Switch
              checked={marketing}
              onCheckedChange={setMarketing}
              aria-label="Activer les cookies marketing"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={rejectAll} className="sm:mr-auto">
            Tout refuser
          </Button>
          <Button variant="outline" onClick={acceptAll}>
            Tout accepter
          </Button>
          <Button onClick={() => savePreferences({ analytics, marketing })}>
            Enregistrer mes choix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
