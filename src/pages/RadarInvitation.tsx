import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Radar, CheckCircle2, AlertCircle, Mail, LogIn, UserPlus, LogOut,
} from 'lucide-react';

const STORAGE_KEY = 'pending_radar_invitation';
const TARGET_ROUTE = '/radar-crm/results';

type ErrorCode =
  | 'email_mismatch'
  | 'invitation_expired'
  | 'invitation_not_pending'
  | 'seats_limit_reached'
  | 'invitation_not_found'
  | 'not_authenticated'
  | 'unknown';

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  email_mismatch:
    "Cette invitation a été envoyée à une autre adresse. Connectez-vous avec l'adresse invitée.",
  invitation_expired: 'Cette invitation a expiré. Demandez-en une nouvelle.',
  invitation_not_pending: 'Cette invitation a déjà été utilisée ou annulée.',
  seats_limit_reached: 'Cet espace a atteint son nombre maximum de membres.',
  invitation_not_found: "Lien d'invitation invalide.",
  not_authenticated: 'Vous devez être connecté pour accepter cette invitation.',
  unknown: "Une erreur est survenue. Réessayez ou demandez une nouvelle invitation.",
};

const KNOWN_CODES: ErrorCode[] = [
  'email_mismatch',
  'invitation_expired',
  'invitation_not_pending',
  'seats_limit_reached',
  'invitation_not_found',
  'not_authenticated',
];

function extractCode(raw: string | null | undefined): ErrorCode {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase();
  return KNOWN_CODES.find((code) => lower.includes(code)) ?? 'unknown';
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'needs_auth' }
  | { kind: 'accepting' }
  | { kind: 'success' }
  | { kind: 'error'; code: ErrorCode };

const RadarInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

  const urlToken = searchParams.get('token');
  // Preserve the token across the auth flow via sessionStorage.
  const token = urlToken || (typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null);

  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const acceptedRef = useRef(false);

  // Keep the token alive while the user goes through login/signup.
  useEffect(() => {
    if (urlToken) {
      try {
        sessionStorage.setItem(STORAGE_KEY, urlToken);
      } catch {
        /* ignore storage failures */
      }
    }
  }, [urlToken]);

  const acceptInvitation = useCallback(async () => {
    if (!token || acceptedRef.current) return;
    acceptedRef.current = true;
    setState({ kind: 'accepting' });

    const { data, error } = await supabase.rpc('accept_radar_invitation', { p_token: token });

    // Errors can surface either as a thrown RPC error or as a structured payload.
    if (error) {
      acceptedRef.current = false;
      setState({ kind: 'error', code: extractCode(error.message) });
      return;
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    const ok = payload.ok === true || payload.success === true || payload.status === 'ok';
    const errCode = (payload.error ?? payload.code ?? payload.reason) as string | undefined;

    if (!ok && errCode) {
      acceptedRef.current = false;
      setState({ kind: 'error', code: extractCode(errCode) });
      return;
    }

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState({ kind: 'success' });
    toast({ title: 'Bienvenue dans l’espace partagé \u2713' });
    setTimeout(() => navigate(TARGET_ROUTE, { replace: true }), 1200);
  }, [token, navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setState({ kind: 'error', code: 'invitation_not_found' });
      return;
    }
    if (!user) {
      setState({ kind: 'needs_auth' });
      return;
    }
    void acceptInvitation();
  }, [authLoading, token, user, acceptInvitation]);

  const goToAuth = (mode: 'signin' | 'signup') => {
    const redirect = `/radar/invitation?token=${encodeURIComponent(token ?? '')}`;
    navigate(`/auth?redirect=${encodeURIComponent(redirect)}${mode === 'signup' ? '&mode=signup' : ''}`);
  };

  const handleSwitchAccount = async () => {
    await signOut();
    setState({ kind: 'needs_auth' });
  };

  const retry = () => {
    acceptedRef.current = false;
    void acceptInvitation();
  };

  return (
    <MainLayout title="Invitation Radar CRM">
      <div className="min-h-[70vh] bg-muted/30 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-3">
              <Radar className="h-6 w-6" />
            </div>
            <h1 className="heading-display text-2xl text-primary">Invitation Radar CRM</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Rejoignez un espace CRM partagé.
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              {(state.kind === 'loading' || state.kind === 'accepting') && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {state.kind === 'accepting'
                      ? 'Validation de votre invitation…'
                      : 'Chargement…'}
                  </p>
                </div>
              )}

              {state.kind === 'needs_auth' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-secondary/60 p-4 text-sm text-foreground flex gap-3">
                    <Mail className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                    <p>
                      Connectez-vous avec l’adresse email à laquelle l’invitation
                      a été envoyée pour rejoindre l’espace.
                    </p>
                  </div>
                  <Button className="w-full" onClick={() => goToAuth('signin')}>
                    <LogIn className="h-4 w-4" /> Se connecter
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => goToAuth('signup')}>
                    <UserPlus className="h-4 w-4" /> Créer un compte
                  </Button>
                </div>
              )}

              {state.kind === 'success' && (
                <div className="flex flex-col items-center gap-3 py-6 text-center animate-scale-in">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                  <p className="font-medium text-foreground">Invitation acceptée !</p>
                  <p className="text-sm text-muted-foreground">
                    Redirection vers votre espace partagé…
                  </p>
                </div>
              )}

              {state.kind === 'error' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 py-2 text-center">
                    <AlertCircle className="h-9 w-9 text-primary" />
                    <p className="text-sm text-foreground">{ERROR_MESSAGES[state.code]}</p>
                  </div>

                  {state.code === 'email_mismatch' && (
                    <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
                      <LogOut className="h-4 w-4" /> Changer de compte
                    </Button>
                  )}

                  {state.code === 'not_authenticated' && (
                    <Button className="w-full" onClick={() => goToAuth('signin')}>
                      <LogIn className="h-4 w-4" /> Se connecter
                    </Button>
                  )}

                  {(state.code === 'unknown' || state.code === 'seats_limit_reached') && user && token && (
                    <Button variant="outline" className="w-full" onClick={retry}>
                      Réessayer
                    </Button>
                  )}

                  <Button variant="ghost" className="w-full" onClick={() => navigate('/radar-crm')}>
                    Retour au Radar CRM
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default RadarInvitation;