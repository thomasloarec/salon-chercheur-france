import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, ExternalLink, UserPlus, LogIn } from 'lucide-react';

interface ClaimData {
  claim_token: string;
  expires_at: string;
  email_from_crm?: string;
}

interface CrmClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  claimData: ClaimData;
  onClaimSuccess: () => void;
}

export function CrmClaimModal({ isOpen, onClose, claimData, onClaimSuccess }: CrmClaimModalProps) {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [email, setEmail] = useState(claimData.email_from_crm || '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const expiresAt = new Date(claimData.expires_at);
  const timeLeft = Math.max(0, expiresAt.getTime() - Date.now());
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));

  const handleSignUp = async () => {
    if (!email || !password || !firstName || !lastName) {
      toast({
        title: "Champs requis",
        description: "Merci de remplir tous les champs.",
        variant: "destructive"
      });
      return;
    }

    setIsSigningUp(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        toast({
          title: "Erreur d'inscription",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      // Attendre que l'utilisateur soit connecté puis réclamer
      toast({
        title: "Inscription réussie",
        description: "Vérifiez votre email pour activer votre compte.",
      });
      
      // La réclamation se fera automatiquement après connexion
      onClaimSuccess();
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite.",
        variant: "destructive"
      });
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      toast({
        title: "Champs requis",
        description: "Email et mot de passe requis.",
        variant: "destructive"
      });
      return;
    }

    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast({
          title: "Erreur de connexion",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      // La réclamation se fera automatiquement après connexion
      toast({
        title: "Connexion réussie",
        description: "Récupération de votre connexion HubSpot...",
      });
      
      onClaimSuccess();
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite.",
        variant: "destructive"
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  // Si l'utilisateur est déjà connecté, déclencher automatiquement le claim
  if (user && isOpen) {
    onClaimSuccess();
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Finalise ta connexion HubSpot
          </DialogTitle>
          <DialogDescription>
            Ta connexion HubSpot est prête ! Créé un compte ou connecte-toi pour l'activer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Indicateur d'expiration */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Expire dans {hoursLeft}h
            </span>
          </div>

          {/* Email pré-rempli */}
          {claimData.email_from_crm && (
            <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm text-blue-700">
                Email HubSpot détecté : <strong>{claimData.email_from_crm}</strong>
              </p>
            </div>
          )}

          {!showSignUp && !showSignIn && (
            <div className="space-y-3">
              <Button 
                onClick={() => setShowSignUp(true)}
                className="w-full"
                size="lg"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Créer un compte et activer
              </Button>
              
              <Button 
                onClick={() => setShowSignIn(true)}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <LogIn className="h-4 w-4 mr-2" />
                J'ai déjà un compte
              </Button>
            </div>
          )}

          {/* Formulaire d'inscription */}
          {showSignUp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Prénom"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Nom"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleSignUp}
                  disabled={isSigningUp}
                  className="flex-1"
                >
                  {isSigningUp ? "Création..." : "Créer le compte"}
                </Button>
                <Button 
                  onClick={() => setShowSignUp(false)}
                  variant="outline"
                >
                  Retour
                </Button>
              </div>
            </div>
          )}

          {/* Formulaire de connexion */}
          {showSignIn && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="signInEmail">Email</Label>
                <Input
                  id="signInEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                />
              </div>
              
              <div>
                <Label htmlFor="signInPassword">Mot de passe</Label>
                <Input
                  id="signInPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="flex-1"
                >
                  {isSigningIn ? "Connexion..." : "Se connecter"}
                </Button>
                <Button 
                  onClick={() => setShowSignIn(false)}
                  variant="outline"
                >
                  Retour
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}