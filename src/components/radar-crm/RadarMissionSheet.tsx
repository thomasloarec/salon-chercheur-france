import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { Loader2, MapPin, RotateCcw, Target } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { trackRadarEvent } from '@/lib/radarCrm/tracking';
import {
  type RelationshipStatus, RELATIONSHIP_ORDER, RELATIONSHIP_META,
} from '@/lib/radarCrm/relationship';
import { buildMissionSuggestion, type OfferProfileInput } from '@/lib/radarCrm/playbooks';
import ExpandableText from '@/components/exhibitor/ExpandableText';


/** Compte ciblé par le panneau mission (couple crm_company_id + salon). */
export interface MissionTarget {
  companyId: string;
  companyName: string;
  nomExposant: string | null;
  stand: string | null;
  eventId: string;
  eventName: string;
}

interface MissionFields {
  objective: string;
  opening_line: string;
  top_q1: string;
  top_q2: string;
  top_q3: string;
}

const EMPTY: MissionFields = {
  objective: '', opening_line: '', top_q1: '', top_q2: '', top_q3: '',
};

const nonEmpty = (v: string | null | undefined) => (v ?? '').trim().length > 0;

/** Badge inline réutilisant les tokens de statut relationnel. */
const RelBadge: React.FC<{ status: RelationshipStatus }> = ({ status }) => {
  const meta = RELATIONSHIP_META[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
};

const RadarMissionSheet: React.FC<{
  target: MissionTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationship: RelationshipStatus;
  onChangeRelationship: (next: RelationshipStatus) => void;
  onOpenSettings: () => void;
}> = ({ target, open, onOpenChange, relationship, onChangeRelationship, onOpenSettings }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<MissionFields>(EMPTY);
  const [offer, setOffer] = useState<OfferProfileInput | null>(null);
  const [offerEmpty, setOfferEmpty] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  // Distingue « suggéré » (régénérable au changement de statut) de « édité » (protégé).
  const [edited, setEdited] = useState(false);
  // Le statut a changé alors que l'utilisateur avait déjà édité → invite discrète.
  const [statusChanged, setStatusChanged] = useState(false);
  // Dernier statut pour lequel des suggestions ont été appliquées / chargées.
  const prevRelRef = useRef<RelationshipStatus>(relationship);
  // Description société (résumé IA ou legacy) affichée sous l'en-tête.
  const [description, setDescription] = useState<string | null>(null);


  // Charge la mission existante + le profil d'offre à l'ouverture, puis préremplit.
  useEffect(() => {
    if (!open || !target) return;
    // Ancre le statut courant : évite une régénération parasite à l'ouverture.
    prevRelRef.current = relationship;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [missionsRes, offerRes] = await Promise.all([
        supabase.rpc('get_radar_salon_missions', { p_event_id: target.eventId }),
        supabase.from('radar_offer_profile').select('sells, target, problem, qualifies').maybeSingle(),
      ]);
      if (cancelled) return;

      const offerRow = (offerRes.data ?? null) as OfferProfileInput | null;
      setOffer(offerRow);
      setOfferEmpty(
        !offerRow || ![offerRow.sells, offerRow.target, offerRow.problem, offerRow.qualifies]
          .some((v) => (v ?? '').trim().length > 0),
      );

      let dbFields: MissionFields = EMPTY;
      if (missionsRes.error) {
        console.error('[RadarCRM] get_radar_salon_missions failed:', missionsRes.error);
      } else {
        const payload = missionsRes.data as { companies?: Array<Record<string, unknown>> } | null;
        const row = (payload?.companies ?? []).find(
          (c) => String(c.crm_company_id ?? '') === target.companyId,
        );
        if (row) {
          dbFields = {
            objective: (row.objective as string) ?? '',
            opening_line: (row.opening_line as string) ?? '',
            top_q1: (row.top_q1 as string) ?? '',
            top_q2: (row.top_q2 as string) ?? '',
            top_q3: (row.top_q3 as string) ?? '',
          };
          setDescription((row.description as string | null) ?? null);
        } else {
          setDescription(null);
        }

      }

      // Préremplissage : garde le travail existant, complète les champs vides via le moteur.
      const suggestion = buildMissionSuggestion(relationship, offerRow);
      setFields({
        objective: nonEmpty(dbFields.objective) ? dbFields.objective : suggestion.objective,
        opening_line: nonEmpty(dbFields.opening_line) ? dbFields.opening_line : suggestion.opening_line,
        top_q1: nonEmpty(dbFields.top_q1) ? dbFields.top_q1 : suggestion.top_q1,
        top_q2: nonEmpty(dbFields.top_q2) ? dbFields.top_q2 : suggestion.top_q2,
        top_q3: nonEmpty(dbFields.top_q3) ? dbFields.top_q3 : suggestion.top_q3,
      });
      // Mission enregistrée en base → considérée éditée (on ne régénère pas au changement de statut).
      const hasSaved =
        nonEmpty(dbFields.objective) || nonEmpty(dbFields.opening_line) ||
        nonEmpty(dbFields.top_q1) || nonEmpty(dbFields.top_q2) || nonEmpty(dbFields.top_q3);
      setEdited(hasSaved);
      setStatusChanged(false);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.companyId, target?.eventId]);

  // Changement de statut relationnel pendant que le Sheet est ouvert.
  useEffect(() => {
    if (!open || !target) return;
    if (prevRelRef.current === relationship) return;
    prevRelRef.current = relationship;
    if (edited) {
      // L'utilisateur a personnalisé : on ne touche à rien, on propose juste.
      setStatusChanged(true);
    } else {
      // Encore à l'état « suggéré » → réapplique les suggestions du nouveau statut.
      setFields({ ...buildMissionSuggestion(relationship, offer) });
      setStatusChanged(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationship]);

  // Toute frappe manuelle bascule le champ en « édité » et masque l'invite de reset.
  const set = (k: keyof MissionFields) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEdited(true);
    setStatusChanged(false);
    setFields((f) => ({ ...f, [k]: e.target.value }));
  };

  // Régénère explicitement objectif + ouverture + TOP 3 depuis le statut courant.
  const regenerate = () => {
    setFields({ ...buildMissionSuggestion(relationship, offer) });
    setEdited(false);
    setStatusChanged(false);
    prevRelRef.current = relationship;
  };

  const applySuggestions = () => {
    regenerate();
    setResetConfirm(false);
    toast({ title: 'Suggestions réappliquées', description: 'Objectif, ouverture et TOP 3 régénérés depuis votre profil.' });
  };

  const handleSave = async () => {
    if (!target) return;
    setSaving(true);
    // COALESCE serveur : on n'envoie que les champs remplis.
    const args: Record<string, string> = {
      p_crm_company_id: target.companyId,
      p_event_id: target.eventId,
    };
    if (nonEmpty(fields.objective)) args.p_objective = fields.objective.trim();
    if (nonEmpty(fields.opening_line)) args.p_opening_line = fields.opening_line.trim();
    if (nonEmpty(fields.top_q1)) args.p_top_q1 = fields.top_q1.trim();
    if (nonEmpty(fields.top_q2)) args.p_top_q2 = fields.top_q2.trim();
    if (nonEmpty(fields.top_q3)) args.p_top_q3 = fields.top_q3.trim();

    const { error } = await supabase.rpc('upsert_radar_mission', args as never);
    setSaving(false);
    if (error) {
      console.error('[RadarCRM] upsert_radar_mission failed:', error);
      toast({
        title: 'Enregistrement impossible',
        description: 'Impossible de sauvegarder cette mission. Réessayez dans un instant.',
        variant: 'destructive',
      });
      return;
    }
    void trackRadarEvent('radar_mission_saved', { eventId: target.eventId });
    toast({ title: 'Mission enregistrée', description: 'Votre préparation est prête pour le salon.' });
    onOpenChange(false);
  };

  const standLabel = useMemo(
    () => (nonEmpty(target?.stand) ? target!.stand!.trim() : 'Stand non renseigné'),
    [target?.stand],
  );

  const showCrm = !!target?.nomExposant && target.nomExposant !== target.companyName;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-hidden"
      >
        <SheetHeader className="px-5 pt-6 pb-4 border-b text-left space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <Target className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Préparation de mission</span>
          </div>
          <SheetTitle className="font-display text-xl leading-snug">
            {target?.nomExposant ?? target?.companyName ?? 'Compte'}
          </SheetTitle>
          <SheetDescription className="space-y-1">
            {showCrm && (
              <span className="block text-xs text-muted-foreground">CRM : {target?.companyName}</span>
            )}
            <span className="block text-sm text-foreground/80">{target?.eventName}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {standLabel}
            </span>
          </SheetDescription>
          {nonEmpty(description) && (
            <ExpandableText
              text={description!}
              className="pt-1"
            />
          )}
        </SheetHeader>


        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              {/* Statut relationnel */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Statut relationnel</Label>
                <Select value={relationship} onValueChange={(v) => onChangeRelationship(v as RelationshipStatus)}>
                  <SelectTrigger className="h-11 w-full">
                    <RelBadge status={relationship} />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_ORDER.map((s) => (
                      <SelectItem key={s} value={s} className="py-2.5">
                        <RelBadge status={s} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Invite discrète : le statut a changé alors que des champs sont édités. */}
              {statusChanged && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
                  <p className="text-xs text-foreground/80">
                    Le statut a changé — réinitialiser les questions ?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerate}
                    className="h-8 shrink-0 border-accent/40 text-accent hover:bg-accent/10 hover:text-accent"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Régénérer
                  </Button>
                </div>
              )}

              {/* Objectif */}
              <div className="space-y-2">
                <Label htmlFor="mission-objective" className="text-sm font-semibold">Objectif de la visite</Label>
                <Textarea
                  id="mission-objective"
                  value={fields.objective}
                  onChange={set('objective')}
                  rows={2}
                  className="resize-none text-base"
                />
              </div>

              {/* Phrase d'ouverture */}
              <div className="space-y-2">
                <Label htmlFor="mission-opening" className="text-sm font-semibold">Phrase d'ouverture</Label>
                <Textarea
                  id="mission-opening"
                  value={fields.opening_line}
                  onChange={set('opening_line')}
                  rows={3}
                  className="resize-none text-base"
                />
              </div>

              {/* TOP 3 */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">TOP 3 — questions à poser</Label>
                {(['top_q1', 'top_q2', 'top_q3'] as const).map((k, i) => (
                  <div key={k} className="flex gap-2 items-start">
                    <span className="mt-2.5 h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <Textarea
                      value={fields[k]}
                      onChange={set(k)}
                      rows={2}
                      className="resize-none text-base"
                    />
                  </div>
                ))}
              </div>

              {offerEmpty && (
                <p className="text-xs text-muted-foreground">
                  Pour des questions plus précises,{' '}
                  <button
                    type="button"
                    onClick={() => { onOpenChange(false); onOpenSettings(); }}
                    className="text-accent underline underline-offset-2 hover:text-accent/80"
                  >
                    complétez votre profil d'offre
                  </button>.
                </p>
              )}

              <button
                type="button"
                onClick={() => setResetConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser depuis mon profil
              </button>
            </>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t bg-muted/20">
          <Button onClick={handleSave} disabled={saving || loading} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser la mission ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les champs objectif, phrase d'ouverture et TOP 3 seront remplacés par les suggestions
              générées depuis votre profil d'offre et le statut actuel du compte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={applySuggestions}>Réinitialiser</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default RadarMissionSheet;
