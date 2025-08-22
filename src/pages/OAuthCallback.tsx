import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readOAuthState, clearOAuthState } from '@/lib/oauthSecurity';
import { CRM_OAUTH_ENABLED, isHubspotConfigValid, getHubspotConfigIssues } from '@/lib/hubspotConfig';
import { debugFetch } from '@/lib/debugFetch';
import { OAUTH_ENDPOINTS } from '@/lib/supabaseConfig';

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
      
      // Check if CRM OAuth is disabled
      if (!CRM_OAUTH_ENABLED) {
        setStatus('error');
        setMessage('Intégrations CRM désactivées');
        if (isDebug) {
          setDebugInfo({
            crm_oauth_enabled: false,
            config_valid: false,
            issues: ['CRM_OAUTH_ENABLED est désactivé'],
            cookie_state_present: false,
            local_state_present: false
          });
        }
        return;
      }
      
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
        crm_oauth_enabled: CRM_OAUTH_ENABLED,
        config_valid: isHubspotConfigValid(),
        issues: getHubspotConfigIssues(),
        cookie_state_present: !!cookie,
        local_state_present: !!local,
        header_state_present: !!headerState,
        state_from_url: state ? state.substring(0, 8) + '...' : 'missing',
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
        // Send error result to parent
        const result = { 
          type: 'hubspot_oauth_result', 
          provider: provider, 
          success: false,
          status: 0,
          stage: 'oauth_error',
          body: { error: `Erreur OAuth: ${error}` }
        };
        try { 
          window.opener?.postMessage(result, 'https://lotexpo.com'); 
        } catch {}
        try { 
          localStorage.setItem('hubspot_last_result', JSON.stringify({ ...result, ts: Date.now() })); 
        } catch {}

        const debug = new URLSearchParams(window.location.search).has('oauthDebug');
        const hold = sessionStorage.getItem('oauth_hold_open') === '1';
        
        if (debug || hold) {
          return; // Don't close or redirect in debug mode
        }

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
        // Send error result to parent
        const result = { 
          type: 'hubspot_oauth_result', 
          provider: provider, 
          success: false,
          status: 0,
          stage: 'missing_code',
          body: { error: 'Code d\'autorisation manquant' }
        };
        try { 
          window.opener?.postMessage(result, 'https://lotexpo.com'); 
        } catch {}
        try { 
          localStorage.setItem('hubspot_last_result', JSON.stringify({ ...result, ts: Date.now() })); 
        } catch {}

        const debug = new URLSearchParams(window.location.search).has('oauthDebug');
        const hold = sessionStorage.getItem('oauth_hold_open') === '1';
        
        if (debug || hold) {
          return; // Don't close or redirect in debug mode
        }

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
        // Call Edge Function with debugFetch
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (headerState) {
          headers['X-OAuth-State'] = headerState;
        }
        
        const response = await debugFetch(OAUTH_ENDPOINTS.hubspotCallback, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            code,
            state
          }),
          debugLabel: `HubSpot OAuth Callback (${provider})`
        });

        const data = await response.json();
        
        // Prepare result for parent window communication
        const result = { 
          type: 'hubspot_oauth_result', 
          provider: provider, 
          success: response.ok && data.success,
          status: response.status,
          stage: data.stage || 'completed',
          body: data
        };

        // Send result to parent window
        try { 
          window.opener?.postMessage(result, 'https://lotexpo.com'); 
        } catch (e) {
          console.warn('Failed to send message to parent:', e);
        }
        
        // Store result in localStorage as fallback
        try { 
          localStorage.setItem('hubspot_last_result', JSON.stringify({ ...result, ts: Date.now() })); 
        } catch (e) {
          console.warn('Failed to store result in localStorage:', e);
        }

        // Check debug and hold open modes
        const debug = new URLSearchParams(window.location.search).has('oauthDebug');
        const hold = sessionStorage.getItem('oauth_hold_open') === '1';

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

        // Handle return URL from sessionStorage
        const returnTo = sessionStorage.getItem('oauth_return_to');
        sessionStorage.removeItem('oauth_return_to');

        // Don't close window if debug or hold mode
        if (debug || hold) {
          if (isDebug) {
            setDebugInfo({
              ...debugData,
              result_data: {
                success: true,
                status: response.status,
                stage: data.stage || 'completed',
                body: JSON.stringify(data, null, 2).substring(0, 500) + (JSON.stringify(data).length > 500 ? '...' : '')
              }
            });
          }
          return; // Don't close or redirect
        }

        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-success',
            provider,
            message: successMessage,
            user_id: data.user_id,
            email: data.email,
            was_created: data.was_created
          }, '*');
          
          // Redirect opener to return URL if available
          if (returnTo && window.opener.location) {
            window.opener.location.href = returnTo;
          }
          window.close();
        } else {
          setTimeout(() => {
            window.location.href = returnTo || '/crm-integrations';
          }, 2000);
        }

      } catch (error) {
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        setMessage(errorMessage);
        
        // Prepare error result for parent window communication
        const result = { 
          type: 'hubspot_oauth_result', 
          provider: provider, 
          success: false,
          status: 0,
          stage: 'error',
          body: { error: errorMessage }
        };

        // Send error result to parent window
        try { 
          window.opener?.postMessage(result, 'https://lotexpo.com'); 
        } catch (e) {
          console.warn('Failed to send error message to parent:', e);
        }
        
        // Store error result in localStorage as fallback
        try { 
          localStorage.setItem('hubspot_last_result', JSON.stringify({ ...result, ts: Date.now() })); 
        } catch (e) {
          console.warn('Failed to store error result in localStorage:', e);
        }

        // Check debug and hold open modes
        const debug = new URLSearchParams(window.location.search).has('oauthDebug');
        const hold = sessionStorage.getItem('oauth_hold_open') === '1';

        // Handle return URL from sessionStorage on error too
        const returnTo = sessionStorage.getItem('oauth_return_to');
        sessionStorage.removeItem('oauth_return_to');
        
        // Don't close window if debug or hold mode
        if (debug || hold) {
          if (isDebug) {
            setDebugInfo({
              ...debugData,
              result_data: {
                success: false,
                status: 0,
                stage: 'error',
                body: errorMessage
              }
            });
          }
          return; // Don't close or redirect
        }
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-error',
            provider,
            message: errorMessage
          }, '*');
          window.close();
        } else {
          setTimeout(() => {
            window.location.href = returnTo || '/crm-integrations';
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
              <div>CRM OAuth Enabled: {debugInfo.crm_oauth_enabled ? '✅' : '❌'}</div>
              <div>Config Valid: {debugInfo.config_valid ? '✅' : '❌'}</div>
              <div>Cookie State: {debugInfo.cookie_state_present ? '✅' : '❌'}</div>
              <div>Local State: {debugInfo.local_state_present ? '✅' : '❌'}</div>
              <div>Header State: {debugInfo.header_state_present ? '✅' : '❌'}</div>
              <div>State from URL: {debugInfo.state_from_url}</div>
              <div>Debug Mode: {debugInfo.is_debug_mode ? '✅' : '❌'}</div>
              {debugInfo.issues && debugInfo.issues.length > 0 && (
                <div>Issues: <code className="bg-red-100 px-1 rounded text-red-700">{debugInfo.issues.join(', ')}</code></div>
              )}
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
            {!searchParams.get('oauthDebug') && !sessionStorage.getItem('oauth_hold_open') && (
              <p className="text-sm text-gray-500 mt-2">Redirection en cours...</p>
            )}
          </>
        )}
        
        {(searchParams.get('oauthDebug') || sessionStorage.getItem('oauth_hold_open')) && 
         (debugInfo?.result_data || status === 'success' || status === 'error') && (
          <div className="mt-6 p-4 bg-gray-50 border rounded-lg text-left max-w-lg mx-auto">
            <h4 className="font-semibold mb-2">🔍 Résultat OAuth</h4>
            <div className="space-y-2 text-sm">
              <div>Success: {debugInfo?.result_data?.success !== undefined ? 
                (debugInfo.result_data.success ? '✅' : '❌') : 
                (status === 'success' ? '✅' : '❌')}</div>
              <div>Status: {debugInfo?.result_data?.status || 'unknown'}</div>
              <div>Stage: {debugInfo?.result_data?.stage || status}</div>
              {debugInfo?.result_data?.body && (
                <div>
                  <div className="font-medium">Response:</div>
                  <pre className="bg-white p-2 border rounded text-xs overflow-auto max-h-32">
                    {typeof debugInfo.result_data.body === 'string' 
                      ? debugInfo.result_data.body 
                      : JSON.stringify(debugInfo.result_data.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <button 
              onClick={() => window.close()} 
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};