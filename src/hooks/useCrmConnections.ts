import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CrmProvider } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type CrmConnectionStatus = {
  [K in CrmProvider]?: boolean;
};

interface CrmConnectionData {
  provider: string;
  portal_id: number | null;
  status: string;
  email_from_crm: string;
  connected_at: string;
  expires_at: string;
}

interface ClaimData {
  claim_token: string;
  expires_at: string;
  email_from_crm?: string;
}

export const useCrmConnections = () => {
  const [connections, setConnections] = useState<CrmConnectionStatus>({});
  const [connectionsData, setConnectionsData] = useState<CrmConnectionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Récupérer les connexions existantes via la RPC
  const fetchConnections = async () => {
    if (!user) {
      setConnections({});
      setConnectionsData([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_crm_connections');

      if (error) {
        console.error('❌ useCrmConnections: Erreur RPC:', error);
        toast({
          title: "Erreur de lecture",
          description: "Impossible de récupérer tes connexions CRM.",
          variant: "destructive"
        });
        setConnections({});
        setConnectionsData([]);
        return;
      }

      const status: CrmConnectionStatus = {};
      const rows: CrmConnectionData[] = [];

      if (data && Array.isArray(data)) {
        data.forEach((conn: any) => {
          const provider = conn.provider as CrmProvider;
          status[provider] = conn.status === 'active';
          rows.push({
            provider: conn.provider,
            portal_id: conn.portal_id ?? null,
            status: conn.status,
            email_from_crm: conn.email_from_crm ?? '',
            connected_at: conn.connected_at ?? '',
            expires_at: conn.expires_at ?? '',
          });
        });
      }

      setConnections(status);
      setConnectionsData(rows);
    } catch (error) {
      console.error('❌ useCrmConnections: Erreur inattendue:', error);
      toast({
        title: "Erreur réseau",
        description: "Impossible de contacter le serveur.",
        variant: "destructive"
      });
      setConnections({});
      setConnectionsData([]);
    } finally {
      setLoading(false);
    }
  };

  // Connecter un CRM (autorisé même sans être connecté)
  const connectCrm = async (provider: CrmProvider) => {
    setLoading(true);
    
    let checkClosedInterval: NodeJS.Timeout | null = null;
    let autoCleanup: NodeJS.Timeout | null = null;
    let handleMessage: ((event: MessageEvent) => Promise<void>) | null = null;
    
    const cleanup = () => {
      if (checkClosedInterval) {
        clearInterval(checkClosedInterval);
        checkClosedInterval = null;
      }
      if (autoCleanup) {
        clearTimeout(autoCleanup);
        autoCleanup = null;
      }
      if (handleMessage) {
        window.removeEventListener('message', handleMessage);
        handleMessage = null;
      }
    };
    
    try {
      // Log des informations de contexte pour debug CORS
      console.log('🌐 CORS Debug Info:', {
        origin: window.location.origin,
        userAgent: navigator.userAgent.slice(0, 50),
        hasUser: !!user,
        provider
      });

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

      if (error) {
        // Gestion spécifique des erreurs OAuth
        let userMessage = "Erreur lors de la récupération de l'URL";
        if (error.message?.includes('CONFIG_MISSING')) {
          userMessage = "Configuration serveur incomplète. Contactez l'admin (variables manquantes).";
        }
        
        throw new Error(userMessage);
      }

      if (!data.installUrl) {
        throw new Error('URL d\'autorisation manquante');
      }

      // 2. Ouvrir popup centrée
      const popup = window.open(
        data.installUrl,
        'oauth-popup',
        'width=500,height=600,left=' + 
        (window.screen.width / 2 - 250) + ',top=' + 
        (window.screen.height / 2 - 300)
      );

      if (!popup) {
        throw new Error('Popup bloquée par le navigateur');
      }

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

      // Cleanup intervals and listeners
      let checkClosedInterval: NodeJS.Timeout;
      checkClosedInterval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosedInterval);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

      // Auto-cleanup after 5 minutes
      const autoCleanup = setTimeout(() => {
        clearInterval(checkClosedInterval);
        window.removeEventListener('message', handleMessage);
        if (popup && !popup.closed) {
          popup.close();
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      if (checkClosedInterval) clearInterval(checkClosedInterval);
      if (autoCleanup) clearTimeout(autoCleanup);
      if (handleMessage) window.removeEventListener('message', handleMessage);
      
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
      setConnectionsData(prev =>
        prev.map(c =>
          c.provider === provider ? { ...c, status: 'revoked' } : c
        )
      );
      toast({
        title: "Déconnexion réussie",
        description: `${provider} a été déconnecté.`,
      });
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  return {
    connections,
    connectionsData,
    loading,
    claimData,
    connectCrm,
    disconnectCrm,
    claimConnection,
    clearClaimData,
    refreshConnections: fetchConnections
  };
};
