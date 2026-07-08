import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SignupWallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelé après conversion réussie du compte anonyme. */
  onUpgraded: () => void;
}

/**
 * Mur "signup" : convertit l'utilisateur anonyme existant (updateUser) pour
 * préserver son user_id et ses crédits — surtout ne PAS créer un nouvel utilisateur.
 */
const SignupWallDialog = ({ open, onOpenChange, onUpgraded }: SignupWallDialogProps) => {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast({
        title: 'Informations incomplètes',
        description: 'Renseignez un email valide et un mot de passe d’au moins 6 caractères.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Conversion de l'utilisateur anonyme : on préserve le user_id (et les crédits).
      const { error } = await supabase.auth.updateUser({
        email: email.trim(),
        password,
        data: firstName.trim() ? { first_name: firstName.trim() } : undefined,
      });

      if (error) {
        toast({
          title: 'Création impossible',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      await supabase.rpc('log_funnel_event', { p_event_type: 'account_created' });

      toast({ title: 'Compte créé ✓', description: '3 recherches supplémentaires débloquées.' });
      onUpgraded();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Une erreur est survenue',
        description: err instanceof Error ? err.message : 'Réessayez dans un instant.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="section-rule" />
          <DialogTitle className="heading-display text-2xl">
            Créez votre compte Lotexpo
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Débloquez 3 recherches supplémentaires et reprenez exactement là où vous en étiez.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ria-firstname">Prénom (optionnel)</Label>
            <Input
              id="ria-firstname"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Thomas"
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ria-email">Email professionnel</Label>
            <Input
              id="ria-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.fr"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ria-password">Mot de passe</Label>
            <Input
              id="ria-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 caractères minimum"
              autoComplete="new-password"
              required
            />
          </div>

          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Créer mon compte et continuer
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Vos recherches déjà effectuées sont conservées.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SignupWallDialog;