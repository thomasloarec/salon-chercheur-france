import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { InvalidWebsiteRow } from './CorrectWebsiteDialog';

type RemovalEvent = {
  id?: string;
  nom_event?: string;
  date_debut?: string | null;
  slug?: string | null;
};

type RemovalPreview = {
  found?: boolean;
  name?: string;
  slug?: string | null;
  source?: string;
  public_identity_id?: string;
  participations_count?: number;
  events_count?: number;
  events?: RemovalEvent[];
  novelties_count?: number;
  leads_count?: number;
  claims_count?: number;
  crm_links_count?: number;
  has_owner?: boolean;
  requires_confirmation?: boolean;
  can_remove_from_site?: boolean;
  warnings?: string[];
};

interface Props {
  row: InvalidWebsiteRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const RemoveExhibitorDialog: React.FC<Props> = ({ row, open, onOpenChange, onSuccess }) => {
  const [preview, setPreview] = useState<RemovalPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [removing, setRemoving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setReason('');
    setConfirmText('');
    setErrorMsg(null);
    setPreview(null);
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('admin_preview_exhibitor_removal', {
          p_public_identity_id: row.public_identity_id,
        });
        if (error) throw error;
        setPreview((data ?? null) as RemovalPreview | null);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Erreur de prévisualisation.');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, row?.public_identity_id]);

  const requiresConfirm = !!preview?.requires_confirmation;
  const reasonOk = reason.trim().length > 0;
  const confirmOk = !requiresConfirm || confirmText === 'RETIRER';
  const canRemove = !!preview?.found && reasonOk && confirmOk && !removing && !loading;

  const handleRemove = async () => {
    if (!row || !canRemove) return;
    setRemoving(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.rpc('admin_remove_exhibitor_from_site', {
        p_public_identity_id: row.public_identity_id,
        p_reason: reason.trim(),
        ...(requiresConfirm ? { p_confirm: 'RETIRER' } : {}),
      });
      if (error) throw error;
      toast.success('Exposant retiré du site', {
        description:
          'Des pages publiques peuvent nécessiter un redéploiement pour refléter le changement dans le pré-rendu.',
      });
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Retirer l'exposant du site
          </DialogTitle>
          <DialogDescription>
            Cette action retirera l'exposant du site et supprimera ses participations aux
            salons, mais ne supprimera pas les données critiques (nouveautés, leads, demandes).
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!loading && row && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div className="font-medium">{preview?.name ?? row.display_name}</div>
              <div className="text-muted-foreground break-all">
                Website actuel : <span className="font-mono">{row.website || '—'}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-[10px]">
                  {preview?.participations_count ?? 0} participation(s)
                </Badge>
                <Badge variant="outline" className="text-[10px]">source: {row.source_type}</Badge>
              </div>
            </div>

            {/* Warnings */}
            {preview?.warnings && preview.warnings.length > 0 && (
              <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                {preview.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Events list */}
            {preview?.events && preview.events.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Événements concernés ({preview.events.length})</Label>
                <div className="max-h-40 overflow-y-auto rounded-md border divide-y text-xs">
                  {preview.events.map((ev, i) => (
                    <div key={ev.id ?? i} className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <span className="truncate">{ev.nom_event ?? 'Événement'}</span>
                      <span className="text-muted-foreground shrink-0">
                        {ev.date_debut ?? ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="remove-reason">
                Motif <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="remove-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. aucun site fiable trouvé, doublon non résolvable…"
                rows={2}
                maxLength={500}
              />
            </div>

            {requiresConfirm && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-text" className="text-destructive">
                  Confirmation requise — tapez RETIRER
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RETIRER"
                  autoComplete="off"
                />
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Pensez à corriger / supprimer aussi cette donnée dans Airtable.</span>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={removing}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={!canRemove}>
            {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Retirer du site
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveExhibitorDialog;