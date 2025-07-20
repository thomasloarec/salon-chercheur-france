
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecretsCheckResult {
  ok: boolean;
  missing?: string[];
  defined?: string[];
  message?: string;
  error?: string;
}

export const useSecretsCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<SecretsCheckResult | null>(null);
  const { toast } = useToast();

  const checkSecrets = useCallback(async () => {
    setIsChecking(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-secrets');
      
      if (error) {
        throw new Error(`API Error: ${error.message}`);
      }

      setResult(data as SecretsCheckResult);
      
      if (data.ok) {
        toast({
          title: 'Configuration vérifiée',
          description: 'Toutes les variables d\'environnement sont configurées',
        });
      }
      
      return data as SecretsCheckResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Secrets check error:', errorMsg);
      
      const errorResult = {
        ok: false,
        error: errorMsg
      };
      
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsChecking(false);
    }
  }, [toast]);

  return {
    checkSecrets,
    isChecking,
    result,
    setResult
  };
};
