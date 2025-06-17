
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
import { useDeleteAccount } from '@/hooks/useProfile';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DeleteAccountModal = ({ isOpen, onClose }: DeleteAccountModalProps) => {
  const [confirmation, setConfirmation] = useState('');
  const [doubleConfirmation, setDoubleConfirmation] = useState(false);
  const deleteAccount = useDeleteAccount();

  const handleFirstConfirmation = () => {
    if (confirmation.toLowerCase() === 'supprimer') {
      setDoubleConfirmation(true);
    }
  };

  const handleFinalDelete = () => {
    deleteAccount.mutate();
    onClose();
  };

  const resetModal = () => {
    setConfirmation('');
    setDoubleConfirmation(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">Supprimer mon compte</DialogTitle>
        </DialogHeader>
        
        {!doubleConfirmation ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                <strong>Attention :</strong> Cette action est irréversible. Toutes vos données seront définitivement supprimées.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Tapez "SUPPRIMER" pour confirmer
              </Label>
              <Input
                id="confirmation"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="SUPPRIMER"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetModal}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleFirstConfirmation}
                disabled={confirmation.toLowerCase() !== 'supprimer'}
              >
                Continuer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">
                Êtes-vous absolument certain de vouloir supprimer votre compte ?
              </p>
              <p className="text-red-700 text-sm mt-2">
                Cette action supprimera définitivement :
              </p>
              <ul className="text-red-700 text-sm mt-1 list-disc list-inside">
                <li>Votre profil et vos informations personnelles</li>
                <li>Vos événements favoris</li>
                <li>Vos abonnements aux newsletters</li>
              </ul>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetModal}>
                Non, annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleFinalDelete}
                disabled={deleteAccount.isPending}
              >
                {deleteAccount.isPending ? 'Suppression...' : 'Oui, supprimer définitivement'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountModal;
