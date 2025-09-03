import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Link } from 'lucide-react';
import type { Event } from '@/types/event';
import { CrmConnectModal } from './CrmConnectModal';

interface EventExhibitorsSectionFallbackProps {
  event: Event;
}

/**
 * Version de fallback robuste pour afficher les exposants et le bouton CRM
 * Utilisée pour garantir l'affichage même en cas de problème d'hydratation
 */
export const EventExhibitorsSectionFallback = ({ event }: EventExhibitorsSectionFallbackProps) => {
  const [showCrmModal, setShowCrmModal] = useState(false);
  const [exhibitorCount, setExhibitorCount] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Force visibility après mount
    setIsVisible(true);
    
    // Quick count des exposants sans bloquer l'affichage
    const getCount = async () => {
      try {
        const { count } = await supabase
          .from('participation')
          .select('*', { count: 'exact', head: true })
          .eq('id_event', event.id);
        
        setExhibitorCount(count || 0);
      } catch (error) {
        console.log('Fallback: Error counting exhibitors:', error);
      }
    };
    
    if (event.id) {
      getCount();
    }
  }, [event.id]);

  console.log('🔄 EventExhibitorsSectionFallback - Force rendu, visible:', isVisible, 'count:', exhibitorCount);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4" style={{ display: 'block !important' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">
          Exposants {exhibitorCount > 0 ? `(${exhibitorCount})` : ''}
          <span className="text-xs text-gray-500 ml-2">- Fallback Mode</span>
        </h3>
        {/* Bouton Connecter CRM désactivé temporairement - à réactiver plus tard */}
        {false && (
          <Button 
            className="bg-accent hover:bg-accent/90"
            onClick={() => setShowCrmModal(true)}
          >
            <Link className="h-4 w-4 mr-2" />
            Connecter mon CRM
          </Button>
        )}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm">
          💡 <strong>Conseil :</strong> Connectez votre CRM pour découvrir facilement vos prospects parmi les exposants.
        </p>
      </div>
      
      {exhibitorCount === 0 ? (
        <p className="text-gray-500 italic">
          Chargement des exposants en cours...
        </p>
      ) : (
        <p className="text-green-600 text-sm">
          ✅ {exhibitorCount} exposants détectés pour cet événement
        </p>
      )}

      {/* Modal de connexion CRM */}
      <CrmConnectModal 
        open={showCrmModal} 
        onOpenChange={setShowCrmModal} 
      />
    </div>
  );
};