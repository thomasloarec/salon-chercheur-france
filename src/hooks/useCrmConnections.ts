import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CrmProvider } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type CrmConnectionStatus = {
  [K in CrmProvider]?: boolean;
};

interface ClaimData {
  claim_token: string;
  expires_at: string;
  email_from_crm?: string;
}

export const useCrmConnections = () => {
  const [connections, setConnections] = useState<CrmConnectionStatus>({});
  const [loading, setLoading] = useState(false);
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Récupérer les connexions existantes via le proxy
  const fetchConnections = async () => {
    // Si l'utilisateur n'est pas connecté, ne pas faire d'appel
    if (!user) {
      console.log('🔍 useCrmConnections: Pas d\'utilisateur connecté, définition état vide');
      setConnections({});
      return;
    }

    try {
      console.log('🔍 useCrmConnections: Récupération des connexions via proxy pour user:', user.id);
      
      // Utiliser le proxy pour contourner les problèmes CORS
      const { data, error } = await supabase.functions.invoke('crm-connections-proxy', {
        body: { action: 'list_connections' }
      });
      
      if (error) {
        console.error('❌ useCrmConnections: Erreur proxy:', error);
        
        if (error.message?.includes('401') || error.message?.includes('SESSION_INVALID')) {
          toast({
            title: "Session expirée",
            description: "Ta session a expiré. Reconnecte-toi.",
            variant: "destructive"
          });
        } else if (error.message?.includes('AWS_PROXY_ERROR')) {
          toast({
            title: "Erreur backend",
            description: "Lecture des connexions impossible (backend). Réessaie plus tard.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erreur de lecture",
            description: "Impossible de récupérer tes connexions CRM.",
            variant: "destructive"
          });
        }
        
        setConnections({});
        return;
      }
      
      const status: CrmConnectionStatus = {};
      if (data && Array.isArray(data)) {
        data.forEach((conn: any) => {
          status[conn.provider as CrmProvider] = true;
        });
      }
      setConnections(status);
    } catch (error) {
      console.error('❌ useCrmConnections: Erreur inattendue:', error);
      
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

  // Connecter un CRM (autorisé même sans être connecté)
  const connectCrm = async (provider: CrmProvider) => {
    console.log('🔄 useCrmConnections: Initiation connexion', provider, 'user:', user ? 'connecté' : 'anonyme');

    setLoading(true);
    try {
      // 1. Récupérer l'URL d'installation avec token optionnel
      const headers: Record<string, string> = {};
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      const { data, error } = await supabase.functions.invoke(`oauth-${provider}`, {
        body: {},
        headers
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

      // 3. Écouter le message de retour
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'oauth-success' && event.data.provider === provider) {
          window.removeEventListener('message', handleMessage);
          popup?.close();
          
          const { mode, claim_token, expires_at, email_from_crm } = event.data;
          
          if (mode === 'attached') {
            // Utilisateur connecté - connexion directe
            await fetchConnections();
            toast({
              title: "Connexion réussie",
              description: `${provider} a été connecté avec succès.`,
            });
          } else if (mode === 'unclaimed') {
            // Utilisateur anonyme - afficher le claim flow
            setClaimData({
              claim_token,
              expires_at,
              email_from_crm
            });
          }
          
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

  // Réclamer une connexion après login/signup
  const claimConnection = async () => {
    if (!claimData || !user) return;

    try {
      const { data, error } = await supabase.functions.invoke('crm-connections-claim', {
        body: { claim_token: claimData.claim_token }
      });

      if (error) {
        console.error('❌ Claim connection error:', error);
        
        if (error.message?.includes('CLAIM_TOKEN_EXPIRED')) {
          toast({
            title: "Token expiré",
            description: "La connexion a expiré. Merci de relancer la connexion HubSpot.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erreur de réclamation",
            description: "Impossible de réclamer la connexion. Réessayez.",
            variant: "destructive"
          });
        }
        return false;
      }

      // Succès
      setClaimData(null); // Clear claim data
      await fetchConnections();
      toast({
        title: "Connexion récupérée",
        description: "Ta connexion HubSpot est maintenant active !",
      });
      return true;
    } catch (error) {
      console.error('❌ Claim connection unexpected error:', error);
      toast({
        title: "Erreur",
        description: "Erreur inattendue lors de la réclamation.",
        variant: "destructive"
      });
      return false;
    }
  };

  // Supprimer les données de claim (si l'utilisateur annule)
  const clearClaimData = () => {
    setClaimData(null);
  };
  // Déconnecter un CRM
  const disconnectCrm = async (provider: CrmProvider) => {
    if (!user) return;

    const { error } = await supabase
      .from('crm_connections')
      .update({ status: 'revoked' })
      .eq('provider', provider)
      .eq('user_id', user.id);

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
    claimData,
    connectCrm,
    disconnectCrm,
    claimConnection,
    clearClaimData,
    refreshConnections: fetchConnections
  };
};