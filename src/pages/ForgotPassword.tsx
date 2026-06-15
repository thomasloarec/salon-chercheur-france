import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { useToast } from '@/hooks/use-toast';

const GENERIC_SUCCESS =
  "Si un compte est associé à cette adresse, vous allez recevoir un email avec les instructions de réinitialisation.";

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });

    setLoading(false);

    if (error) {
      // Network / rate limit (e.g. 429): generic retry message, no success state.
      toast({
        title: 'Une erreur est survenue',
        description: 'Impossible de traiter votre demande pour le moment. Veuillez réessayer dans quelques minutes.',
        variant: 'destructive',
      });
      return;
    }

    // Anti-enumeration: always the same message regardless of account existence.
    setSubmitted(true);
  };

  return (
    <MainLayout title="Mot de passe oublié">
      <div className="bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary">Lotexpo</h1>
            <p className="text-gray-600 mt-2">Réinitialisez votre mot de passe</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Mot de passe oublié ?</CardTitle>
              <CardDescription className="text-center">
                Entrez votre email pour recevoir un lien de réinitialisation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="space-y-4">
                  <Alert className="border-green-200 bg-green-50">
                    <AlertDescription className="text-green-700">
                      {GENERIC_SUCCESS}
                    </AlertDescription>
                  </Alert>
                  <Link
                    to="/auth"
                    className="block text-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Retour à la connexion
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
                  </Button>

                  <Link
                    to="/auth"
                    className="block text-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Retour à la connexion
                  </Link>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default ForgotPassword;
