import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readOAuthState, clearOAuthState } from '@/lib/oauthSecurity';

export const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Finalisation de la connexion...');
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const isDebug = searchParams.get('oauthDebug') === '1';
      
      // Detect provider from URL path or query param
      const pathname = window.location.pathname;
      let provider = searchParams.get('provider') || 'hubspot';
      if (pathname.includes('hubspot')) {
        provider = 'hubspot';
      }

      // Read OAuth state from cookie and localStorage
      const { cookie, local } = readOAuthState();
      
      // Determine header state with priority: cookie > localStorage > URL state (debug only)
      let headerState = cookie ?? local ?? (isDebug ? state : null);
      
      // Debug info
      const debugData = {
        cookie_state_present: !!cookie,
        local_state_present: !!local,
        header_state_present: !!headerState,
        is_debug_mode: isDebug
      };
      
      if (isDebug) {
        setDebugInfo(debugData);
        console.log('🔍 OAuth Debug Info:', debugData);
        
        if (!cookie && !local && state) {
          console.warn('⚠️ Fallback to URL state in debug mode');
        }
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
        } else if (!isDebug) {
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
        } else if (!isDebug) {
          setTimeout(() => {
            window.location.href = '/crm-integrations';
          }, 2000);
        }
        return;
      }

      try {
        // Call Edge Function directly with fetch
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (headerState) {
          headers['X-OAuth-State'] = headerState;
        }
        
        const response = await fetch(`https://vxivdvzzhebobveedxbj.supabase.co/functions/v1/oauth-${provider}-callback`, {
          method: 'POST',
          headers,
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

        // Success - clear OAuth state
        clearOAuthState();
        
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
        } else if (!isDebug) {
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
        } else if (!isDebug) {
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
        {debugInfo && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-left max-w-md mx-auto">
            <h4 className="font-semibold text-blue-900 mb-2">🔍 OAuth Debug Info</h4>
            <div className="space-y-1 text-blue-800">
              <div>Cookie State: {debugInfo.cookie_state_present ? '✅' : '❌'}</div>
              <div>Local State: {debugInfo.local_state_present ? '✅' : '❌'}</div>
              <div>Header State: {debugInfo.header_state_present ? '✅' : '❌'}</div>
              <div>Debug Mode: {debugInfo.is_debug_mode ? '✅' : '❌'}</div>
            </div>
          </div>
        )}
        
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