import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { validateOAuthState, clearOAuthStateCookie } from '@/lib/oauthSecurity';

export const OAuthCallback = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      // Detect provider from URL path or query param
      const pathname = window.location.pathname;
      let provider = searchParams.get('provider') || 'hubspot';
      if (pathname.includes('hubspot')) {
        provider = 'hubspot';
      }

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

      // Validate OAuth state for security
      if (state) {
        const isStateValid = validateOAuthState(state, provider);
        if (!isStateValid) {
          window.opener?.postMessage({
            type: 'oauth-error',
            provider,
            message: 'État OAuth invalide - possible attaque CSRF'
          }, '*');
          clearOAuthStateCookie(provider);
          window.close();
          return;
        }
      }

      try {
        // Debug mode logging
        const isDebugMode = searchParams.get('oauthDebug') === '1';
        if (isDebugMode) {
          console.log('🔍 OAuth Debug Mode - Provider:', provider);
          console.log('🔍 OAuth Debug Mode - Code:', code ? 'Present' : 'Missing');
          console.log('🔍 OAuth Debug Mode - State:', state ? 'Present' : 'Missing');
          console.log('🔍 OAuth Debug Mode - Calling Edge Function:', `oauth-${provider}-callback`);
        }

        // Échanger le code contre les tokens
        const { data, error: callbackError } = await supabase.functions.invoke(
          `oauth-${provider}-callback`,
          {
            body: { code, state, provider }
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

        // Clear OAuth state cookie after successful exchange
        clearOAuthStateCookie(provider);

      } catch (error) {
        window.opener?.postMessage({
          type: 'oauth-error',
          provider,
          message: error instanceof Error ? error.message : 'Erreur inconnue'
        }, '*');
        
        // Clear OAuth state cookie on error
        clearOAuthStateCookie(provider);
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