import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Finalisation de la connexion HubSpot...');
  const [stage, setStage] = useState<string | null>(null);
  const [portalId, setPortalId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(`Autorisation refusée : ${error}`);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Code d\'autorisation manquant');
        setStage('missing_code');
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke('oauth-hubspot-callback', {
          body: { code, state }
        });

        if (fnError) {
          throw fnError;
        }

        if (data?.success === true) {
          setStatus('success');
          setPortalId(data.portal_id ?? null);
          setMessage('Connexion réussie, import de vos comptes en cours…');
          setSyncing(true);
          void (async () => {
            try {
              const { data: syncData } = await supabase.functions.invoke('sync-hubspot');
              if (syncData?.success) {
                setMessage(
                  data.portal_id
                    ? `HubSpot connecté au portail ${data.portal_id} — ${syncData.companies ?? 0} compte(s) importé(s)`
                    : `HubSpot connecté — ${syncData.companies ?? 0} compte(s) importé(s)`
                );
              } else {
                setMessage(
                  data.portal_id
                    ? `HubSpot connecté au portail ${data.portal_id} — import des comptes en échec`
                    : 'HubSpot connecté — import des comptes en échec'
                );
              }
            } catch (syncErr) {
              setMessage(
                data.portal_id
                  ? `HubSpot connecté au portail ${data.portal_id} — import des comptes en échec`
                  : 'HubSpot connecté — import des comptes en échec'
              );
            } finally {
              setSyncing(false);
              setTimeout(() => {
                window.location.href = '/radar-crm';
              }, 1500);
            }
          })();
          return;
        }

        setStatus('error');
        setStage(data?.stage ?? 'unknown');
        setMessage(data?.message ?? 'La connexion a échoué.');
      } catch (err) {
        setStatus('error');
        setStage('network');
        setMessage(err instanceof Error ? err.message : 'Erreur inattendue lors de la connexion.');
      }
    };

    void handleCallback();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            {syncing ? (
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
            )}
            <h1 className="heading-display text-2xl mb-2">{message}</h1>
            {portalId && !syncing && (
              <p className="text-sm text-muted-foreground mb-4">
                Portail HubSpot n° {portalId}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {syncing ? 'Import de vos comptes HubSpot en cours…' : 'Redirection vers Radar CRM…'}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h1 className="heading-display text-2xl mb-2">La connexion a échoué</h1>
            {stage && stage !== 'unknown' && (
              <p className="text-sm font-medium text-destructive mb-2">
                Étape : {stage}
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <Button asChild className="rounded-full">
              <Link to="/radar-crm">Réessayer</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
