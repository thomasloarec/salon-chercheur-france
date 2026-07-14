import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Users, Upload, PencilLine, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEventScorecard } from '@/hooks/useEventScorecard';

interface SeoScorecardProps {
  eventId: string;
  onSwitchToEdit?: () => void;
}

export const SeoScorecard: React.FC<SeoScorecardProps> = ({ eventId, onSwitchToEdit }) => {
  const { data, isLoading, error } = useEventScorecard(eventId);
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [localConfirmed, setLocalConfirmed] = useState<boolean | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        Impossible de charger la scorecard pour le moment.
      </p>
    );
  }

  const anyData = data as any;
  if (anyData?.error === 'not_authorized') {
    return (
      <p className="text-sm text-muted-foreground">
        Vous n'avez pas accès à la scorecard de ce salon.
      </p>
    );
  }

  const { completude, visibilite_30j, genere_le } = anyData;
  const pct = Math.max(0, Math.min(100, Number(completude?.pct_enrichies ?? 0)));
  const listeConfirmee = localConfirmed ?? Boolean(completude?.liste_confirmee);

  const handleToggleConfirm = async (checked: boolean) => {
    setConfirming(true);
    setLocalConfirmed(checked);
    try {
      const { error } = await supabase.rpc('set_exhibitors_complete' as any, {
        p_event_id: eventId,
        p_confirmed: checked,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['event-scorecard', eventId] });
      toast.success(checked ? 'Liste confirmée complète.' : 'Confirmation retirée.');
    } catch (e: any) {
      setLocalConfirmed(!checked);
      toast.error(e?.message || 'Impossible de mettre à jour.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Complétude */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">État de votre salon</h3>
          <Badge variant="secondary">{pct}%</Badge>
        </div>
        <Progress value={pct} />
        <div className="grid grid-cols-2 gap-3">
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="Exposants référencés"
            value={completude?.exposants_references ?? 0}
          />
          <Metric
            icon={<Sparkles className="h-4 w-4" />}
            label="Exposants avec fiche détaillée"
            value={completude?.fiches_enrichies ?? 0}
            hint={`${pct}%`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {pct}% de vos exposants ont une fiche détaillée.
        </p>

        <div className="rounded-md border p-3 space-y-2">
          {listeConfirmee ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Liste confirmée complète</span>
              <button
                type="button"
                className="ml-auto text-xs text-muted-foreground underline"
                onClick={() => handleToggleConfirm(false)}
                disabled={confirming}
              >
                annuler
              </button>
            </div>
          ) : (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={listeConfirmee}
                onCheckedChange={(v) => handleToggleConfirm(Boolean(v))}
                disabled={confirming}
                className="mt-0.5"
              />
              <span>Je confirme que la liste de mes exposants est complète.</span>
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Si des exposants manquent, vous pourrez bientôt importer votre liste complète.
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button variant="outline" size="sm" disabled>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Importer votre liste exposants
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Bientôt disponible</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div>
          <Button variant="outline" size="sm" onClick={onSwitchToEdit}>
            <PencilLine className="h-3.5 w-3.5 mr-1.5" />
            Améliorer votre description
          </Button>
        </div>
      </Card>

      {/* Visibilité IA */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Visibilité dans l'IA (30 jours)</h3>
        {!visibilite_30j?.available || visibilite_30j?.below_threshold ? (
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Données en cours de constitution
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-foreground/80">
              <span className="font-semibold text-foreground">
                {visibilite_30j.requetes_secteur}
              </span>{' '}
              recherches touchaient vos secteurs sur 30 jours ; votre salon est apparu dans{' '}
              <span className="font-semibold text-foreground">
                {visibilite_30j.apparitions}
              </span>{' '}
              réponses.
            </p>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                Taux de capture : {visibilite_30j.taux_capture_pct}%
              </Badge>
              {typeof visibilite_30j.requetes_sans_reponse === 'number' && (
                <span className="text-xs text-muted-foreground">
                  {visibilite_30j.requetes_sans_reponse} recherches sans réponse
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {genere_le && (
        <p className="text-[11px] text-muted-foreground">
          Données à J-1 · généré le {new Date(genere_le).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  );
};

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}> = ({ icon, label, value, hint }) => (
  <div className="rounded-md border p-2.5">
    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-1 flex items-baseline gap-1">
      <span className="text-lg font-semibold">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  </div>
);

export default SeoScorecard;