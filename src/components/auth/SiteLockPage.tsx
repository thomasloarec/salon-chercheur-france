import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SiteLockPageProps {
  onUnlock: (password: string) => Promise<boolean>;
}

const SiteLockPage = ({ onUnlock }: SiteLockPageProps) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const isValid = await onUnlock(password);
      
      if (!isValid) {
        setError('Mot de passe incorrect. Veuillez réessayer.');
        setPassword('');
      }
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">LotExpo</h1>
          <p className="text-muted-foreground">Plateforme de référence des salons professionnels</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Accès réservé</CardTitle>
            <CardDescription className="text-center">
              Ce site est actuellement en phase de test.
              <br />
              Veuillez saisir le mot de passe pour continuer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-12 text-base"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-destructive font-medium">
                    {error}
                  </p>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={!password || isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Vérification...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Déverrouiller le site</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-center text-muted-foreground">
                L'accès sera maintenu pendant toute la durée de votre session de navigation.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2025 LotExpo. Tous droits réservés.
        </p>
      </div>
    </div>
  );
};

export default SiteLockPage;
