import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CrmProvider } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type CrmConnectionStatus = {
  [K in CrmProvider]?: boolean;
};

export const useCrmConnections = () => {
  const [connections, setConnections] = useState<CrmConnectionStatus>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Récupérer les connexions existantes
  const fetchConnections = async () => {
    // Si l'utilisateur n'est pas connecté, ne pas faire d'appel
    if (!user) {
      console.log('🔍 useCrmConnections: Pas d\'utilisateur connecté, définition état vide');
      setConnections({});
      return;
    }

    try {
      console.log('🔍 useCrmConnections: Récupération des connexions pour user:', user.id);
      const { data, error } = await supabase
        .from('user_crm_connections')
        .select('provider');
      
      if (error) {
        console.error('❌ useCrmConnections: Erreur récupération connexions:', error);
        
        // Gestion spécifique de l'erreur 403 AWS API Gateway
        if (error.message?.includes('403') || error.code === 'PGRST301') {
          console.error('🔴 AWS API Gateway 403 Error:', {
            error: error,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.slice(0, 100),
            origin: window.location.origin
          });
          
          toast({
            title: "Erreur d'accès",
            description: "Lecture des connexions refusée (403). Vérifier CORS/API key/Authorization sur l'API Gateway.",
            variant: "destructive"
          });
        }
        
        setConnections({});
        return;
      }
      
      const status: CrmConnectionStatus = {};
      if (data) {
        data.forEach(conn => {
          status[conn.provider as CrmProvider] = true;
        });
      }
      setConnections(status);
    } catch (error) {
      console.error('❌ useCrmConnections: Erreur inattendue lors de la récupération:', error);
      
      // Détection d'erreur 403 dans les exceptions génériques
      if (String(error).includes('403')) {
        toast({
          title: "Erreur d'accès",
          description: "Lecture des connexions refusée (403). Vérifier CORS/API key/Authorization sur l'API Gateway.",
          variant: "destructive"
        });
      }
      
      setConnections({});
    }
  };

  // Connecter un CRM
  const connectCrm = async (provider: CrmProvider) => {
    console.log('🔄 useCrmConnections: Initiation connexion', provider, 'user:', user ? 'connecté' : 'non connecté');

    setLoading(true);
    try {
      // TODO: Configuration CORS attendue côté API Gateway AWS:
      // - Origin: https://lotexpo.com
      // - Methods: POST, OPTIONS  
      // - Headers: Authorization, Content-Type
      // - Response Headers: Access-Control-Allow-Origin, Access-Control-Allow-Headers, Access-Control-Allow-Methods, Vary: Origin

      // Log des détails de la requête pour diagnostic
      const requestOrigin = window.location.origin;
      console.info('🔍 OAuth Request Details:', {
        provider,
        origin: requestOrigin,
        userAgent: navigator.userAgent.slice(0, 100),
        timestamp: new Date().toISOString()
      });

      // 1. Récupérer l'URL d'installation
      const { data, error } = await supabase.functions.invoke(`oauth-${provider}`, {
        body: {}
      });

      if (error || !data.installUrl) {
        console.error('❌ OAuth init failed:', { error, data });
        throw new Error(data?.error || 'Erreur lors de la récupération de l\'URL');
      }

      // 2. Ouvrir popup centrée
      const popup = window.open(
        data.installUrl,
        'oauth-popup',
        'width=500,height=600,left=' + 
        (window.screen.width / 2 - 250) + ',top=' + 
        (window.screen.height / 2 - 300)
      );

      // 3. Écouter le message de retour avec gestion d'erreurs améliorée
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'oauth-success' && event.data.provider === provider) {
          window.removeEventListener('message', handleMessage);
          popup?.close();
          
          await fetchConnections();
          toast({
            title: "Connexion réussie",
            description: `${provider} a été connecté avec succès.`,
          });
        } else if (event.data.type === 'oauth-error') {
          window.removeEventListener('message', handleMessage);
          popup?.close();
          
          const errorData = event.data;
          let userMessage = "Erreur lors de la connexion.";
          
          // Messages d'erreur contextuels basés sur les codes d'erreur
          if (errorData.code === "HUBSPOT_TOKEN_EXCHANGE_FAILED") {
            userMessage = "La connexion à HubSpot a échoué (400). Vérifiez l'URL de redirection et les scopes dans HubSpot. Code technique: HUBSPOT_TOKEN_EXCHANGE_FAILED.";
          } else if (errorData.code === "STATE_MISMATCH") {
            userMessage = "Session expirée. Merci de relancer la connexion.";
          } else if (errorData.code === "CONFIG_MISSING") {
            userMessage = "Configuration serveur incomplète. Contactez l'admin (variables manquantes).";
          }
          
          console.error('🔴 OAuth Error Details:', {
            code: errorData.code,
            message: errorData.message,
            originalError: errorData,
            timestamp: new Date().toISOString()
          });
          
          toast({
            title: "Erreur de connexion",
            description: userMessage,
            variant: "destructive",
          });
        }
      };

      window.addEventListener('message', handleMessage);

      // Vérifier si le popup a été fermé manuellement
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (error) {
      console.error('🔴 Connect CRM Error:', {
        provider,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Déconnecter un CRM
  const disconnectCrm = async (provider: CrmProvider) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_crm_connections')
      .delete()
      .eq('provider', provider);

    if (!error) {
      setConnections(prev => ({ ...prev, [provider]: false }));
      toast({
        title: "Déconnexion réussie",
        description: `${provider} a été déconnecté.`,
      });
    }
  };

  useEffect(() => {
    // Forcer le fetch même sans utilisateur pour initialiser l'état
    console.log('🔍 useCrmConnections - useEffect triggered, user:', user ? 'connected' : 'anonymous');
    fetchConnections();
  }, [user]);

  return {
    connections,
    loading,
    connectCrm,
    disconnectCrm,
    refreshConnections: fetchConnections
  };
};