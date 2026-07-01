import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Trash2, AlertTriangle, CheckCircle2, Info, Target, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataDeleted?: () => void;
  /** Notifié après un enregistrement réussi du profil d'offre (pour rafraîchir le nudge cockpit). */
  onOfferProfileSaved?: () => void;
}

type Access = {
  access_status: string;
  trial_ends_at: string | null;
};

type Prefs = {
  radar_alerts_enabled: boolean;
  trial_teasers_enabled: boolean;
  preferred_alert_timing_days: number;
  max_emails_per_week: number;
  radar_email_enabled: boolean;
  radar_email_unsubscribed_at: string | null;
  radar_email_disabled_at: string | null;
};

type OfferProfile = {
  sells: string;
  target: string;
  problem: string;
  qualifies: string;
};

const STATUS_LABELS: Record<string, string> = {
  beta: 'Beta gratuite',
  trial: 'Essai actif',
  active: 'Abonnement actif',
  expired: 'Essai terminé',
  cancelled: 'Abonnement annulé',
};

const RadarCrmSettingsDialog: React.FC<Props> = ({ open, onOpenChange, onDataDeleted, onOfferProfileSaved }) => {
  const [access, setAccess] = useState<Access | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [offer, setOffer] = useState<OfferProfile>({ sells: '', target: '', problem: '', qualifies: '' });
  const [offerSaving, setOfferSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void trackRadarEvent('radar_settings_opened', { source: 'radar_crm' });
    setLoading(true);
    (async () => {
      const [a, p, o] = await Promise.all([
        supabase.rpc('get_or_create_my_radar_access'),
        supabase.rpc('get_or_create_my_crm_notification_preferences'),
        supabase.from('radar_offer_profile').select('sells, target, problem, qualifies').maybeSingle(),
      ]);
      const accessRow = (Array.isArray(a.data) ? a.data[0] : a.data) as Access | null;
      const prefRow = (Array.isArray(p.data) ? p.data[0] : p.data) as Prefs | null;
      setAccess(accessRow ?? { access_status: 'beta', trial_ends_at: null });
      setPrefs(prefRow ?? {
        radar_alerts_enabled: true,
        trial_teasers_enabled: true,
        preferred_alert_timing_days: 14,
        max_emails_per_week: 2,
        radar_email_enabled: false,
        radar_email_unsubscribed_at: null,
        radar_email_disabled_at: null,
      });
      if (o.error) {
        // Multi-workspace ou anomalie de lecture : ne pas deviner, on log et on laisse les champs vides.
        console.error('[RadarCRM] lecture radar_offer_profile échouée:', o.error);
      }
      const offerRow = (o.data ?? null) as Partial<OfferProfile> | null;
      setOffer({
        sells: offerRow?.sells ?? '',
        target: offerRow?.target ?? '',
        problem: offerRow?.problem ?? '',
        qualifies: offerRow?.qualifies ?? '',
      });
      setLoading(false);
    })();
  }, [open]);

  const saveOffer = async () => {
    setOfferSaving(true);
    const { error } = await supabase.rpc('upsert_radar_offer_profile', {
      p_sells: offer.sells.trim(),
      p_target: offer.target.trim(),
      p_problem: offer.problem.trim(),
      p_qualifies: offer.qualifies.trim(),
    });
    setOfferSaving(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: "Profil d'offre enregistré" });
    void trackRadarEvent('radar_offer_profile_saved', { source: 'radar_crm' });
    onOfferProfileSaved?.();
  };

  const updatePref = async (patch: Partial<Prefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return; }
    const { error } = await supabase
      .from('crm_notification_preferences')
      .update(patch)
      .eq('user_id', uid);
    setSaving(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Préférences mises à jour' });
    void trackRadarEvent('radar_notification_preferences_updated', {
      source: 'radar_crm',
      ...patch,
    });
  };

  const toggleEmail = async (enabled: boolean) => {
    if (enabled) {
      await updatePref({
        radar_email_enabled: true,
        radar_email_unsubscribed_at: null,
        radar_email_disabled_at: null,
      });
    } else {
      await updatePref({
        radar_email_enabled: false,
        radar_email_disabled_at: new Date().toISOString(),
      });
    }
  };

  const handleDeleteClick = () => {
    void trackRadarEvent('radar_data_delete_clicked', { source: 'radar_crm' });
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    void trackRadarEvent('radar_data_delete_confirmed', { source: 'radar_crm' });
    const { data, error } = await supabase.rpc('delete_my_radar_crm_data');
    setDeleting(false);
    if (error) {
      toast({ title: 'Erreur lors de la suppression', description: error.message, variant: 'destructive' });
      return;
    }
    const summary = (data ?? {}) as unknown as Record<string, number>;
    void trackRadarEvent('radar_data_deleted', {
      source: 'radar_crm',
      deletedImports: summary.deleted_imports ?? summary.deletedImports ?? 0,
      deletedCompanies: summary.deleted_companies ?? summary.deletedCompanies ?? 0,
      deletedMatches: summary.deleted_matches ?? summary.deletedMatches ?? 0,
      deletedAlerts: summary.deleted_alerts ?? summary.deletedAlerts ?? 0,
    });
    toast({
      title: 'Données Radar CRM supprimées',
      description: `Imports: ${summary.deleted_imports ?? 0} · Entreprises: ${summary.deleted_companies ?? 0} · Correspondances: ${summary.deleted_matches ?? 0}`,
    });
    setConfirmOpen(false);
    onOpenChange(false);
    onDataDeleted?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paramètres Radar CRM</DialogTitle>
            <DialogDescription>
              Gérez votre statut, vos préférences d'alertes et vos données Radar CRM.
            </DialogDescription>
          </DialogHeader>

          {loading || !prefs || !access ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Bloc A — Statut */}
              <Card>
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Statut Radar CRM</h3>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                      {STATUS_LABELS[access.access_status] ?? 'Beta'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Radar CRM est actuellement disponible en Beta gratuite.
                  </p>
                </CardContent>
              </Card>

              {/* Bloc A bis — Profil d'offre commercial */}
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Profil d'offre commercial</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Décrivez votre offre pour que Radar CRM personnalise vos questions de terrain avant chaque salon.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="offer-sells" className="font-medium">Ce que vous vendez</Label>
                    <Input
                      id="offer-sells"
                      value={offer.sells}
                      onChange={(e) => setOffer((o) => ({ ...o, sells: e.target.value }))}
                      placeholder="Ex : capteurs industriels"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="offer-target" className="font-medium">Votre cible</Label>
                    <Input
                      id="offer-target"
                      value={offer.target}
                      onChange={(e) => setOffer((o) => ({ ...o, target: e.target.value }))}
                      placeholder="Ex : industriels agroalimentaires, PME et ETI"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Label htmlFor="offer-problem" className="font-medium">Le problème que vous adressez</Label>
                      <span className="text-[11px] font-medium text-accent">
                        le plus utile pour personnaliser vos questions
                      </span>
                    </div>
                    <Textarea
                      id="offer-problem"
                      value={offer.problem}
                      onChange={(e) => setOffer((o) => ({ ...o, problem: e.target.value }))}
                      placeholder="Ex : fiabilité des composants sur les lignes de production"
                      className="min-h-[72px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="offer-qualifies" className="font-medium">
                      Ce que vous cherchez à qualifier <span className="text-muted-foreground font-normal">(optionnel)</span>
                    </Label>
                    <Textarea
                      id="offer-qualifies"
                      value={offer.qualifies}
                      onChange={(e) => setOffer((o) => ({ ...o, qualifies: e.target.value }))}
                      placeholder="Ex : lignes récentes, enjeux de maintenance"
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => void saveOffer()} disabled={offerSaving}>
                      {offerSaving ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Bloc B — Préférences */}
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <h3 className="font-semibold">Préférences d'alertes</h3>
                  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Les alertes automatiques Radar CRM seront activées prochainement. Ces préférences vous permettront de contrôler la fréquence des notifications.
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="font-medium">Recevoir les alertes Radar CRM</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Vous recevrez des alertes lorsqu'une entreprise de votre Radar CRM est détectée sur un événement à venir.
                      </p>
                    </div>
                    <Switch
                      checked={prefs.radar_alerts_enabled}
                      disabled={saving}
                      onCheckedChange={(v) => void updatePref({ radar_alerts_enabled: v })}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 border-t pt-4">
                    <div className="flex-1">
                      <Label className="font-medium">Recevoir les alertes Radar CRM par email</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Recevez un email lorsque des entreprises de votre CRM sont détectées sur des salons à venir. Indépendant des notifications internes Lotexpo ci-dessus.
                      </p>
                    </div>
                    <Switch
                      checked={prefs.radar_email_enabled}
                      disabled={saving}
                      onCheckedChange={(v) => void toggleEmail(v)}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="font-medium">Recevoir les rappels après la Beta / fin d'essai</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Lorsque Radar CRM deviendra payant, vous pourrez recevoir des notifications limitées vous indiquant que des opportunités ont été détectées, sans révéler les détails.
                      </p>
                    </div>
                    <Switch
                      checked={prefs.trial_teasers_enabled}
                      disabled={saving}
                      onCheckedChange={(v) => void updatePref({ trial_teasers_enabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Moment préféré de l'alerte</Label>
                      <Select
                        value={String(prefs.preferred_alert_timing_days)}
                        onValueChange={(v) => void updatePref({ preferred_alert_timing_days: Number(v) })}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[7, 14, 21, 30].map((d) => (
                            <SelectItem key={d} value={String(d)}>{d} jours avant l'événement</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Maximum d'emails par semaine</Label>
                      <Select
                        value={String(prefs.max_emails_per_week)}
                        onValueChange={(v) => void updatePref({ max_emails_per_week: Number(v) })}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bloc C — Confidentialité */}
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Vos données Radar CRM restent privées</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Les fichiers importés dans Radar CRM sont utilisés uniquement pour détecter les correspondances entre vos entreprises et les exposants référencés sur Lotexpo. Vos données Radar CRM ne sont pas affichées publiquement. Elles ne modifient pas les événements, les exposants ou les données publiques du site.
                  </p>
                  <ul className="text-sm space-y-1.5">
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Données visibles uniquement par vous</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Matching basé sur les sites web des entreprises</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Suppression possible à tout moment</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Bloc D — Suppression */}
              <Card className="border-destructive/40">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <h3 className="font-semibold">Supprimer mes données Radar CRM</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cette action supprimera vos imports, les entreprises importées, les correspondances détectées et les alertes Radar CRM associées.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Elle ne supprimera pas votre compte Lotexpo, votre agenda, les événements ajoutés à votre agenda, ni les exposants ou événements publics de Lotexpo.
                  </p>
                  <Button variant="destructive" onClick={handleDeleteClick}>
                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer mes données Radar CRM
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Vos imports Radar CRM, entreprises importées et correspondances seront supprimés. Vous pourrez réimporter un fichier plus tard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void handleConfirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Suppression…' : 'Confirmer la suppression'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RadarCrmSettingsDialog;