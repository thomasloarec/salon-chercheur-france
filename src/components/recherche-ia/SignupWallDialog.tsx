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
import { Loader2, Mail, Search } from 'lucide-react';
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

  const handleGoogleAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/recherche-ia`,
      },
    });
    if (error) {
      console.error('Error with Google auth:', error);
    }
  };

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

        <div className="space-y-4 pt-2">
          <Button
            onClick={handleGoogleAuth}
            variant="outline"
            className="w-full flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuer avec Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Créer mon compte et continuer
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Vos recherches déjà effectuées sont conservées.
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignupWallDialog;
