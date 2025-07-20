
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AirtableStatus {
  secretsOk: boolean;
  missing?: string[];
  testsOk: boolean;
  testsFailStep?: string;
  dedupOk: boolean;
  buttonsActive: boolean;
}

export const useAirtableStatus = () => {
  const [status, setStatus] = useState<AirtableStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('airtable-status');
      
      if (error) {
        throw new Error(`API Error: ${error.message}`);
      }

      setStatus(data as AirtableStatus);
      return data as AirtableStatus;
    } catch (error) {
      const errorResult: AirtableStatus = {
        secretsOk: false,
        testsOk: false,
        dedupOk: false,
        buttonsActive: false,
        testsFailStep: error instanceof Error ? error.message : 'Erreur inconnue'
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
