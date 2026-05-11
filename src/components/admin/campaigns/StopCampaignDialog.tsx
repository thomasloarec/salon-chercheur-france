import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  STOP_REASONS, STOP_REASON_LABELS, TERMINAL_BLACKLIST_REASONS, type StopReason,
} from '@/lib/outreach/labels';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  contactEmail?: string | null;
  onStopped?: () => void;
}

const StopCampaignDialog = ({ open, onOpenChange, campaignId, contactEmail, onStopped }: Props) => {
  const [reason, setReason] = useState<StopReason | ''>('');
  const [note, setNote] = useState('');
  const { toast } = useToast();
  const qc = useQueryClient();

  const isBlacklisting = !!reason && TERMINAL_BLACKLIST_REASONS.includes(reason as StopReason);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reason) throw new Error('Motif requis');
      const { data, error } = await supabase.functions.invoke('outreach-campaign-action', {
        body: { action: 'stop', campaign_id: campaignId, reason, note: note || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Campagne arrêtée', description: STOP_REASON_LABELS[reason as StopReason] });
      qc.invalidateQueries({ queryKey: ['exhibitor-outreach'] });
      qc.invalidateQueries({ queryKey: ['admin-outreach-dashboard'] });
      qc.invalidateQueries({ queryKey: ['admin-exhibitors'] });
      qc.invalidateQueries({ queryKey: ['email-blacklist'] });
      setReason(''); setNote('');
      onOpenChange(false);
      onStopped?.();
    },
    onError: (e: any) => toast({ title: 'Erreur', description: e?.message ?? 'Action impossible', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arrêter la campagne</DialogTitle>
          <DialogDescription>
            Aucun email ne sera envoyé après l'arrêt. Cette action est tracée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motif d'arrêt *</Label>
            <Select value={reason} onValueChange={v => setReason(v as StopReason)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un motif" /></SelectTrigger>
              <SelectContent>
                {STOP_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{STOP_REASON_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isBlacklisting && contactEmail && (
            <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-destructive">Blacklist globale</div>
                <div className="text-muted-foreground">
                  L'adresse <span className="font-mono">{contactEmail}</span> sera bloquée pour
                  toutes les futures campagnes, sur tous les événements.
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Note interne (facultatif)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Contexte, retour terrain, source de l'info..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!reason || mutation.isPending}
          >
            {mutation.isPending ? 'Arrêt en cours...' : 'Arrêter la campagne'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StopCampaignDialog;