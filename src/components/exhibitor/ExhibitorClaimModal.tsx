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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import { toast } from 'sonner';
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ExhibitorClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitorId: string;
  exhibitorName: string;
  exhibitorWebsite?: string;
  idExposant?: string;
}

const ExhibitorClaimModal: React.FC<ExhibitorClaimModalProps> = ({
  open,
  onOpenChange,
  exhibitorId,
  exhibitorName,
  exhibitorWebsite,
  idExposant,
}) => {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const { data: profileData, isLoading: profileLoading } = useProfileComplete();

  const profileIncomplete = profileData && !profileData.isComplete;

  const handleSubmit = async () => {
    if (profileIncomplete) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('exhibitor-claim-bridge', {
        body: {
          exhibitor_uuid: exhibitorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exhibitorId)
            ? exhibitorId
            : undefined,
          id_exposant: idExposant || undefined,
          name: exhibitorName,
          website: exhibitorWebsite || undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.message || 'Une erreur est survenue.');
        return;
      }

      if (data?.already_pending) {
        toast.info('Vous avez déjà une demande en cours pour cette entreprise.');
      } else {
        toast.success('Demande envoyée', {
          description:
            "Votre demande est en attente de validation par l'équipe Lotexpo. " +
            'Vous la retrouverez dans votre profil. Vous pouvez déjà soumettre une nouveauté pour cette entreprise.',
          duration: 8000,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['exhibitor-governance'] });
      onOpenChange(false);
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

        {profileLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : profileIncomplete ? (
          <Alert variant="destructive" className="my-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p>Votre profil doit être complété à 100% avant de pouvoir faire une demande de gestion.</p>
              <p className="text-sm font-medium">Champs manquants : {profileData.missingFields.join(', ')}</p>
              <Button variant="outline" size="sm" asChild className="mt-2">
                <Link to="/profile" onClick={() => onOpenChange(false)}>
                  Compléter mon profil
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
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
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || profileIncomplete || profileLoading}>
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
