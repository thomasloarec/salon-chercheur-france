import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { useToast } from '@/hooks/use-toast';

type Status = 'verifying' | 'ready' | 'invalid' | 'updating' | 'success';

const ResetPassword = () => {
  const [status, setStatus] = useState<Status>('verifying');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Detect the recovery session (handle the implicit-flow race).
  useEffect(() => {
    let resolved = false;

    const markReady = () => {
      if (resolved) return;
      resolved = true;
      setStatus('ready');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        markReady();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady();
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setStatus('invalid');
      }
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 6 caractères.',
        variant: 'destructive',
      });
      return;
    }

    setStatus('updating');

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de réinitialiser le mot de passe.',
        variant: 'destructive',
      });
      setStatus('ready');
      return;
    }

    toast({
      title: 'Mot de passe réinitialisé',
      description: 'Votre mot de passe a été changé avec succès.',
    });
    setStatus('success');
    setTimeout(() => navigate('/', { replace: true }), 2000);
  };

  const ToggleButton = ({ visible, onToggle }: { visible: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      tabIndex={-1}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  const renderBody = () => {
    if (status === 'verifying') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Vérification du lien…</p>
        </div>
      );
    }

    if (status === 'invalid') {
      return (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">Ce lien est invalide ou a expiré.</p>
          <Button className="w-full" onClick={() => navigate('/mot-de-passe-oublie')}>
            Demander un nouveau lien
          </Button>
        </div>
      );
    }

    if (status === 'success') {
      return (
        <div className="space-y-4 text-center">
          <p className="text-primary">
            Votre mot de passe a été réinitialisé. Redirection en cours…
          </p>
          <Button className="w-full" onClick={() => navigate('/', { replace: true })}>
            Accéder à mon compte
          </Button>
        </div>
      );
    }

    // 'ready' | 'updating'
    const isUpdating = status === 'updating';
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-new-password">Nouveau mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-new-password"
              type={showNew ? 'text' : 'password'}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 pr-10"
              required
              minLength={6}
            />
            <ToggleButton visible={showNew} onToggle={() => setShowNew(!showNew)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-confirm-password">Confirmer le mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 pr-10"
              required
              minLength={6}
            />
            <ToggleButton visible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isUpdating}>
          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isUpdating ? 'Mise à jour…' : 'Réinitialiser mon mot de passe'}
        </Button>
      </form>
    );
  };

  return (
    <MainLayout title="Réinitialiser le mot de passe">
      <div className="bg-muted/30 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="heading-display text-3xl text-primary">Lotexpo</h1>
            <p className="text-muted-foreground mt-2">Définissez votre nouveau mot de passe</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Nouveau mot de passe</CardTitle>
              <CardDescription className="text-center">
                Choisissez un nouveau mot de passe pour votre compte
              </CardDescription>
            </CardHeader>
            <CardContent>{renderBody()}</CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default ResetPassword;
