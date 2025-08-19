import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const OAuthCallback = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const provider = searchParams.get('provider') || 'hubspot';

      if (error) {
        window.opener?.postMessage({
          type: 'oauth-error',
          provider,
          message: `Erreur OAuth: ${error}`
        }, '*');
        window.close();
        return;
      }

      if (!code) {
        window.opener?.postMessage({
          type: 'oauth-error',
          provider,
          message: 'Code d\'autorisation manquant'
        }, '*');
        window.close();
        return;
      }

      try {
        // Échanger le code contre les tokens
        const { data, error: callbackError } = await supabase.functions.invoke(
          `oauth-${provider}-callback`,
          {
            body: { code, state }
          }
        );

        if (callbackError || !data.success) {
          throw new Error(data?.error || 'Erreur lors de l\'échange de tokens');
        }

        // Handle both authenticated and unauthenticated flows
        let message = 'Connexion réussie';
        if (data.was_created) {
          message = 'Compte créé et CRM connecté avec succès';
        } else if (data.email) {
          message = `CRM connecté à votre compte ${data.email}`;
        }

        window.opener?.postMessage({
          type: 'oauth-success',
          provider,
          message,
          user_id: data.user_id,
          email: data.email,
          was_created: data.was_created
        }, '*');

      } catch (error) {
        window.opener?.postMessage({
          type: 'oauth-error',
          provider,
          message: error instanceof Error ? error.message : 'Erreur inconnue'
        }, '*');
      }

      window.close();
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Finalisation de la connexion...</p>
      </div>
    </div>
  );
};