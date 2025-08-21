import { useState } from 'react';
import { generateOAuthNonce, setOAuthState, validateOAuthState, clearOAuthState } from '@/lib/oauthSecurity';
import { buildHubSpotAuthUrl, HUBSPOT_CLIENT_ID, HUBSPOT_REDIRECT_URI, CRM_OAUTH_ENABLED, isHubspotConfigValid, getHubspotConfigIssues } from '@/lib/hubspotConfig';

export interface HubSpotOAuthResponse {
  success: boolean;
  mock?: boolean;
  message?: string;
  installUrl?: string;
  user_id?: string;
  email?: string;
  was_created?: boolean;
  error?: string;
  stage?: string;
  details?: string;
}

export const useHubSpotOAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateOAuth = async (debug: boolean = false): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Check if CRM OAuth is enabled
      if (!CRM_OAUTH_ENABLED) {
        throw new Error('Intégrations CRM désactivées (flag CRM_OAUTH_ENABLED)');
      }

      // Check HubSpot configuration
      if (!isHubspotConfigValid()) {
        const issues = getHubspotConfigIssues();
        throw new Error(`Configuration HubSpot invalide: ${issues.join(', ')}`);
      }

      console.log('🔄 Initiating HubSpot OAuth flow...');
      
      // Generate secure state nonce
      const state = generateOAuthNonce();
      console.log('🔒 Generated OAuth state:', state.substring(0, 8) + '...');
      
      // Store state in secure cookie and localStorage
      setOAuthState(state);
      
      if (debug) {
        console.log("oauth_state set", { value: state });
        console.log("HubSpot config", { 
          client_id: HUBSPOT_CLIENT_ID, 
          redirect_uri: HUBSPOT_REDIRECT_URI 
        });
      }

      // Check for debug config in sessionStorage
      const debugClientId = sessionStorage.getItem('oauth_debug_client_id');
      const debugRedirectUri = sessionStorage.getItem('oauth_debug_redirect_uri');
      
      // Build OAuth URL using centralized config or debug values
      const authResult = buildHubSpotAuthUrl(state, debugClientId || undefined, debugRedirectUri || undefined);
      
      if (authResult.error) {
        throw new Error(authResult.error);
      }

      if (!authResult.url) {
        throw new Error('Impossible de générer l\'URL d\'autorisation HubSpot');
      }
      
      if (debug) {
        console.log('AuthorizeURL:', authResult.url);
      }

      console.log('✅ Opening HubSpot OAuth popup...');
      
      // Store return URL for redirect after completion
      sessionStorage.setItem('oauth_return_to', window.location.href);
      
      // Open OAuth popup
      const popup = window.open(
        authResult.url,
        'hubspot-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked - please allow popups for this site');
      }

      // Listen for OAuth result
      return new Promise<void>((resolve, reject) => {
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;

          const { type, provider, message, error: oauthError } = event.data;
          
          if (provider !== 'hubspot') return;

          window.removeEventListener('message', messageHandler);
          
          if (type === 'oauth-success') {
            console.log('✅ HubSpot OAuth completed successfully:', message);
            // Clear the state after successful OAuth
            clearOAuthState();
            resolve();
          } else if (type === 'oauth-error') {
            console.error('❌ HubSpot OAuth error:', oauthError || message);
            // Clear the state on error too
            clearOAuthState();
            reject(new Error(oauthError || message || 'OAuth failed'));
          }
        };

        window.addEventListener('message', messageHandler);

        // Clean up if popup is closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            clearOAuthState();
            reject(new Error('OAuth cancelled by user'));
          }
        }, 1000);
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown OAuth error';
      console.error('HubSpot OAuth error:', err);
      setError(errorMessage);
      clearOAuthState();
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    initiateOAuth,
    loading,
    error,
  };
};