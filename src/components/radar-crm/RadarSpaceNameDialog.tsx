import React, { useState } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  accountId: string | null;
  /** Appelé après enregistrement OU report ("Plus tard"). Le parent décide de la navigation. */
  onClose: () => void;
}

/**
 * Invite l'owner à nommer l'entreprise associée à un espace Radar CRM.
 * Frontend only : consomme le RPC set_radar_space_name (owner/admin only).
 */
const RadarSpaceNameDialog: React.FC<Props> = ({ open, accountId, onClose }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || !accountId) return;
    setSaving(true);
    const { error } = await supabase.rpc('set_radar_space_name', {
      p_account_id: accountId,
      p_name: trimmed,
    });
    setSaving(false);
    if (error) {
      const message = /forbidden/i.test(error.message)
        ? "Seul le propriétaire peut nommer l'espace."
        : error.message;
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Entreprise enregistrée', description: trimmed });
    setName('');
    onClose();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Nommez votre espace
          </AlertDialogTitle>
          <AlertDialogDescription>
            À quelle entreprise correspond ce CRM ? Ce nom aide votre équipe à repérer le bon espace.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="radar-space-name">Nom de l'entreprise</Label>
          <Input
            id="radar-space-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
            placeholder="Ex : Standex Electronics"
            disabled={saving}
          />
        </div>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Plus tard</Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? (<><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enregistrement…</>) : 'Enregistrer'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RadarSpaceNameDialog;
