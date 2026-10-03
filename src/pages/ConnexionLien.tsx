import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { requestLoginLink, safeNextPath } from '@/components/assistant/loginLink';

export default function ConnexionLien() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isRealUser } = useAuth();
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  const next = safeNextPath(params.get('next'));

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (isRealUser && !busy) navigate(next, { replace: true });
  }, [isRealUser, busy, next, navigate]);

  const login = async () => {
    if (!tokenHash || !type) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
    if (error) {
      setFailed(true);
      setBusy(false);
      return;
    }
    navigate(next, { replace: true });
  };

  const resend = async () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError('Vérifiez votre adresse email.');
      return;
    }
    setSending(true);
    setError(null);
    const err = await requestLoginLink(e, next);
    setSending(false);
    if (err) setError(err);
    else setSentTo(e);
  };

  const incomplete = !tokenHash || !type;

  return (
    <MainLayout title="Connexion à Lotexpo">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="heading-display mb-3 text-[28px] leading-tight text-foreground">Connexion à Lotexpo</h1>
          {incomplete ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">Ce lien est incomplet.</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            </div>
          ) : !failed ? (
            <div className="space-y-5">
              <p className="text-muted-foreground">Cliquez pour vous connecter et retrouver votre assistant salons.</p>
              <Button className="h-12 w-full text-base" disabled={busy} onClick={login}>
                {busy ? 'Connexion…' : 'Me connecter'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-foreground">Ce lien n'est plus valable. Il ne sert qu'une fois et expire au bout d'une heure.</p>
              {sentTo ? (
                <p className="text-foreground">
                  Un nouveau lien vous attend à <span className="break-all font-semibold">{sentTo}</span>.
                </p>
              ) : (
                <>
                  <label className="block text-sm font-medium text-foreground" htmlFor="cx-email">Votre email</label>
                  <Input id="cx-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button className="h-12 w-full" disabled={sending} onClick={resend}>
                    {sending ? 'Envoi…' : 'Recevoir un nouveau lien'}
                  </Button>
                </>
              )}
              <Link to="/auth" className="block text-center text-sm text-muted-foreground underline">
                Se connecter autrement
              </Link>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
