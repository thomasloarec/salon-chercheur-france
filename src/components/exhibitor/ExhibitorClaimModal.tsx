import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface ExhibitorClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitorId: string;
  exhibitorName: string;
}

const ExhibitorClaimModal: React.FC<ExhibitorClaimModalProps> = ({
  open,
  onOpenChange,
  exhibitorId,
  exhibitorName,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      // Double-check no pending request exists
      const { data: existing } = await supabase
        .from('exhibitor_claim_requests')
        .select('id')
        .eq('exhibitor_id', exhibitorId)
        .eq('requester_user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        toast.info('Vous avez déjà une demande en cours pour cette entreprise.');
        onOpenChange(false);
        return;
      }

      const { error } = await supabase.from('exhibitor_claim_requests').insert({
        exhibitor_id: exhibitorId,
        requester_user_id: user.id,
      });

      if (error) throw error;

      toast.success('Votre demande a bien été envoyée. Elle sera vérifiée par l\'équipe Lotexpo.');
      queryClient.invalidateQueries({ queryKey: ['exhibitor-governance', exhibitorId] });
      onOpenChange(false);
      setReason('');
    } catch (err: any) {
      console.error('Claim submission error:', err);
      toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Devenir gestionnaire officiel
          </DialogTitle>
          <DialogDescription>
            Vous souhaitez gérer le profil de <strong>{exhibitorName}</strong> sur Lotexpo.
            Votre demande sera vérifiée par notre équipe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            En tant que gestionnaire officiel, vous pourrez :
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Publier des nouveautés au nom de l'entreprise</li>
            <li>Gérer les leads et demandes de contact</li>
            <li>Afficher le badge « Profil vérifié »</li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Envoi…
              </>
            ) : (
              'Envoyer ma demande'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExhibitorClaimModal;
