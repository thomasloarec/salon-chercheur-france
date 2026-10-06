import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, LogIn, LogOut, Mail, ScanLine, UserPlus } from 'lucide-react';

import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { acceptInvite, boothErrorMessage, type BoothAcceptResult } from '@/lib/booth/rpc';

const STORAGE_KEY = 'booth_invite_token';
const ROUTE = '/leads/invitation';

type ErrKind = 'mismatch' | 'expired' | 'invalid' | 'other';
type View =
  | { kind: 'loading' }
  | { kind: 'no_token' }
  | { kind: 'needs_auth' }
  | { kind: 'accepting' }
  | { kind: 'success'; result: BoothAcceptResult }
  | { kind: 'error'; err: ErrKind; message: string };

const readStored = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const clearStored = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

export default function LeadsInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isRealUser, loading: authLoading, signOut } = useAuth();

  const urlToken = searchParams.get('token');
  const [token] = useState<string | null>(() => urlToken || readStored());
  const [view, setView] = useState<View>({ kind: 'loading' });
  const acceptedRef = useRef(false);

  // Conserver le jeton pendant la connexion et le retirer de l'adresse affichée.
  useEffect(() => {
    if (urlToken) {
      try {
        sessionStorage.setItem(STORAGE_KEY, urlToken);
      } catch {
        /* ignore */
      }
      navigate(ROUTE, { replace: true });
    }
  }, [urlToken, navigate]);

  const accept = useCallback(async () => {
    if (!token || acceptedRef.current) return;
    acceptedRef.current = true;
    setView({ kind: 'accepting' });
    try {
      const result = await acceptInvite(token);
      clearStored();
      qc.invalidateQueries({ queryKey: ['booth-my-context'] });
      setView({ kind: 'success', result });
      setTimeout(() => navigate('/leads', { replace: true }), 1500);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? '');
      let err: ErrKind = 'other';
      if (msg.includes('BOOTH_EMAIL_MISMATCH')) err = 'mismatch';
      else if (msg.includes('BOOTH_INVITE_EXPIRED')) err = 'expired';
      else if (msg.includes('BOOTH_INVITE_INVALID')) err = 'invalid';
      if (err === 'expired' || err === 'invalid') clearStored();
      if (err === 'other') acceptedRef.current = false;
      setView({ kind: 'error', err, message: boothErrorMessage(e) });
    }
  }, [token, navigate, qc]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setView({ kind: 'no_token' });
      return;
    }
    if (!isRealUser) {
      setView({ kind: 'needs_auth' });
      return;
    }
    void accept();
  }, [authLoading, token, isRealUser, accept]);

  const goToAuth = (mode: 'signin' | 'signup') =>
    navigate(`/auth?redirect=${encodeURIComponent(ROUTE)}${mode === 'signup' ? '&mode=signup' : ''}`);

  const switchAccount = async () => {
    await signOut();
    acceptedRef.current = false;
    navigate(ROUTE, { replace: true });
    setView({ kind: 'needs_auth' });
  };

  const retry = () => {
    acceptedRef.current = false;
    void accept();
  };

  return (
    <MainLayout title="Invitation Lotexpo Leads">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-[70vh] bg-muted/30 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-3">
              <ScanLine className="h-6 w-6" />
            </div>
            <h1 className="heading-display text-2xl text-primary">Invitation Lotexpo Leads</h1>
          </div>

          <Card>
            <CardContent className="p-6">
              {(view.kind === 'loading' || view.kind === 'accepting') && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {view.kind === 'accepting' ? 'Validation de votre invitation…' : 'Chargement…'}
                  </p>
                </div>
              )}

              {view.kind === 'no_token' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-foreground">Lien d'invitation incomplet. Ouvrez le lien reçu par email.</p>
                </div>
              )}

              {view.kind === 'needs_auth' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground text-center">
                    Rejoignez votre équipe sur Lotexpo Leads
                  </h2>
                  <div className="rounded-lg bg-secondary/60 p-4 text-sm text-foreground flex gap-3">
                    <Mail className="h-5 w-5 shrink-0 mt-0.5" />
                    <p>Connectez-vous ou créez votre compte avec l'adresse email qui a reçu l'invitation.</p>
                  </div>
                  <Button className="w-full" onClick={() => goToAuth('signin')}>
                    <LogIn className="h-4 w-4" /> Se connecter
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => goToAuth('signup')}>
                    <UserPlus className="h-4 w-4" /> Créer mon compte
                  </Button>
                </div>
              )}

              {view.kind === 'success' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                  <p className="font-medium text-foreground">Bienvenue dans l'équipe {view.result.exhibitor_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Rôle : {view.result.role === 'manager' ? 'Manager' : 'Commercial terrain'}
                  </p>
                  <Button onClick={() => navigate('/leads', { replace: true })}>Continuer</Button>
                </div>
              )}

              {view.kind === 'error' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  {view.err === 'mismatch' ? (
                    <>
                      <p className="text-sm text-foreground">
                        Cette invitation a été envoyée à une autre adresse que celle de votre compte ({user?.email}).
                      </p>
                      <Button variant="outline" onClick={switchAccount}>
                        <LogOut className="h-4 w-4" /> Me déconnecter et changer de compte
                      </Button>
                    </>
                  ) : view.err === 'expired' ? (
                    <>
                      <p className="text-sm text-foreground">{view.message}</p>
                      <p className="text-sm text-muted-foreground">
                        Demandez à votre responsable de vous renvoyer l'invitation.
                      </p>
                    </>
                  ) : view.err === 'invalid' ? (
                    <>
                      <p className="text-sm text-foreground">{view.message}</p>
                      <Button onClick={() => navigate('/leads')}>Aller à Lotexpo Leads</Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-foreground">{view.message}</p>
                      <Button variant="outline" onClick={retry}>
                        Réessayer
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
