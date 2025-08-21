import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateOAuthNonce, setOAuthStateCookie, validateOAuthState, clearOAuthStateCookie } from '@/lib/oauthSecurity';

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
      console.log('🔄 Initiating HubSpot OAuth flow...');
      
      // Generate secure state nonce
      const state = generateOAuthNonce();
      console.log('🔒 Generated OAuth state:', state.substring(0, 8) + '...');
      
      // Store state in secure cookie
      setOAuthStateCookie(state, 'hubspot');

      // Get OAuth install URL from Edge Function
      const { data, error: functionError } = await supabase.functions.invoke('oauth-hubspot', {
        body: { 
          state,
          oauthDebug: debug ? '1' : '0'
        }
      });

      if (functionError) {
        throw new Error(`OAuth initialization error: ${functionError.message}`);
      }

      if (data?.mock) {
        console.log('🔧 HubSpot OAuth in mock mode');
        throw new Error('HubSpot OAuth is in mock mode - please configure secrets');
      }

      if (!data?.installUrl) {
        throw new Error('No OAuth URL received from server');
      }

      console.log('✅ Opening HubSpot OAuth popup...');
      
      // Open OAuth popup
      const popup = window.open(
        data.installUrl,
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
            // Clear the state cookie after successful OAuth
            clearOAuthStateCookie('hubspot');
            resolve();
          } else if (type === 'oauth-error') {
            console.error('❌ HubSpot OAuth error:', oauthError || message);
            // Clear the state cookie on error too
            clearOAuthStateCookie('hubspot');
            reject(new Error(oauthError || message || 'OAuth failed'));
          }
        };

        window.addEventListener('message', messageHandler);

        // Clean up if popup is closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            clearOAuthStateCookie('hubspot');
            reject(new Error('OAuth cancelled by user'));
          }
        }, 1000);
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown OAuth error';
      console.error('HubSpot OAuth error:', err);
      setError(errorMessage);
      clearOAuthStateCookie('hubspot');
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