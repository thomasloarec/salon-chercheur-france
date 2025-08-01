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

    console.log('🔍 useCrmConnections: Récupération des connexions pour user:', user.id);
    const { data, error } = await supabase
      .from('user_crm_connections')
      .select('provider');
    
    if (error) {
      console.error('❌ useCrmConnections: Erreur récupération connexions:', error);
      return;
    }
    
    const status: CrmConnectionStatus = {};
    if (data) {
      data.forEach(conn => {
        status[conn.provider as CrmProvider] = true;
      });
    }
    setConnections(status);
  };

  // Connecter un CRM
  const connectCrm = async (provider: CrmProvider) => {
    // Si l'utilisateur n'est pas connecté, rediriger vers la page de connexion
    if (!user) {
      toast({
        title: "Authentification requise",
        description: "Veuillez vous connecter pour accéder aux fonctionnalités CRM.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Récupérer l'URL d'installation
      const { data, error } = await supabase.functions.invoke(`oauth-${provider}`, {
        body: {}
      });

      if (error || !data.installUrl) {
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
          
          await fetchConnections();
          toast({
            title: "Connexion réussie",
            description: `${provider} a été connecté avec succès.`,
          });
        } else if (event.data.type === 'oauth-error') {
          window.removeEventListener('message', handleMessage);
          popup?.close();
          
          toast({
            title: "Erreur de connexion",
            description: event.data.message || "Erreur lors de la connexion.",
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