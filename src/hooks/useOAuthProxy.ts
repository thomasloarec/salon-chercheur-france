
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OAuthProxyResponse {
  success: boolean;
  mock?: boolean;
  message?: string;
  provider?: string;
  token?: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  error?: string;
  details?: string;
}

export const useOAuthProxy = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exchangeCodeForToken = async (code: string, provider: string = 'salesforce'): Promise<OAuthProxyResponse> => {
    setLoading(true);
    setError(null);

    try {
      console.log(`🔄 Exchanging OAuth code for ${provider}...`);
      
      const { data, error: functionError } = await supabase.functions.invoke('oauth-proxy', {
        body: { code, provider }
      });

      if (functionError) {
        console.error('Supabase function error:', functionError);
        setError(`Function error: ${functionError.message}`);
        return { success: false, error: functionError.message };
      }

      if (data?.mock) {
        console.log('🔧 OAuth in mock mode:', data);
      } else {
        console.log('✅ OAuth token received:', { 
          provider: data?.provider, 
          hasToken: !!data?.token?.access_token 
        });
      }

      return data as OAuthProxyResponse;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('OAuth proxy error:', err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    exchangeCodeForToken,
    loading,
    error,
  };
};
