
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangeEmailModal = ({ isOpen, onClose }: ChangeEmailModalProps) => {
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail.includes('@')) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une adresse email valide.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      toast({
        title: "Email de confirmation envoyé",
        description: "Vérifiez votre boîte mail pour confirmer le changement d'adresse.",
      });

      onClose();
      setNewEmail('');
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de changer l'adresse email.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Changer mon adresse email</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-email">Nouvelle adresse email</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nouvelle@adresse.com"
              required
            />
            <p className="text-sm text-gray-600">
              Un email de confirmation sera envoyé à cette adresse.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Envoi...' : 'Envoyer la confirmation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeEmailModal;
