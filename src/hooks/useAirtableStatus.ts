
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AirtableStatus {
  secretsOk: boolean;
  missing?: string[];
  testsOk: boolean;
  testsFailStep?: string;
  testsError?: {
    error: string;
    status?: number;
    message?: string;
    context?: string;
  };
  dedupOk: boolean;
  buttonsActive: boolean;
  debug?: any;
}

export const useAirtableStatus = () => {
  const [status, setStatus] = useState<AirtableStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    console.log('[useAirtableStatus] 🔄 Début vérification status');
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('airtable-status');
      
      if (error) {
        console.error('[useAirtableStatus] ❌ Erreur API:', error);
        throw new Error(`API Error: ${error.message}`);
      }

      console.log('[useAirtableStatus] 📊 Status reçu:', data);
      setStatus(data as AirtableStatus);
      return data as AirtableStatus;
    } catch (error) {
      console.error('[useAirtableStatus] ❌ Exception:', error);
      const errorResult: AirtableStatus = {
        secretsOk: false,
        testsOk: false,
        dedupOk: false,
        buttonsActive: false,
        testsFailStep: error instanceof Error ? error.message : 'Erreur inconnue',
        testsError: {
          error: 'hook_exception',
          message: error instanceof Error ? error.message : 'Erreur inconnue',
          context: 'HOOK_ERROR'
        }
      };
      
      setStatus(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    status,
    isLoading,
    checkStatus
  };
};
