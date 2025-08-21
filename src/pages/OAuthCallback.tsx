import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOAuthStateCookie } from '@/lib/oauthSecurity';

export const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Finalisation de la connexion...');

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
        setStatus('error');
        setMessage(`Erreur OAuth: ${error}`);
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            provider,
            message: `Erreur OAuth: ${error}`
          }, '*');
          window.close();
        } else {
          setTimeout(() => {
            window.location.href = '/crm-integrations';
          }, 2000);
        }
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Code d\'autorisation manquant');
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            provider,
            message: 'Code d\'autorisation manquant'
          }, '*');
          window.close();
        } else {
          setTimeout(() => {
            window.location.href = '/crm-integrations';
          }, 2000);
        }
        return;
      }

      try {
        // Get OAuth state from cookie
        const cookieState = getOAuthStateCookie(provider);
        
        // Call Edge Function directly with fetch
        const response = await fetch(`https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-${provider}-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-OAuth-State': cookieState || '',
          },
          body: JSON.stringify({
            provider,
            code,
            state
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Erreur ${response.status}: ${response.statusText}`);
        }

        // Success
        setStatus('success');
        let successMessage = 'Connexion réussie';
        if (data.was_created) {
          successMessage = 'Compte créé et CRM connecté avec succès';
        } else if (data.email) {
          successMessage = `CRM connecté à votre compte ${data.email}`;
        }
        setMessage(successMessage);

        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-success',
            provider,
            message: successMessage,
            user_id: data.user_id,
            email: data.email,
            was_created: data.was_created
          }, '*');
          window.close();
        } else {
          setTimeout(() => {
            window.location.href = '/crm-integrations';
          }, 2000);
        }

      } catch (error) {
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        setMessage(errorMessage);
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            provider,
            message: errorMessage
          }, '*');
          window.close();
        } else {
          setTimeout(() => {
            window.location.href = '/crm-integrations';
          }, 2000);
        }
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-4xl mb-4">✅</div>
            <p className="text-green-600">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-500 text-4xl mb-4">❌</div>
            <p className="text-red-600">{message}</p>
            <p className="text-sm text-gray-500 mt-2">Redirection en cours...</p>
          </>
        )}
      </div>
    </div>
  );
};