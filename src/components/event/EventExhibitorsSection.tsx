
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Link } from 'lucide-react';
import type { Event } from '@/types/event';
import { CrmConnectModal } from './CrmConnectModal';

interface Exhibitor {
  nom_exposant: string;
  stand_exposant?: string;
  website_exposant?: string;
  exposant_description?: string;
  urlexpo_event?: string;
  has_exhibitor_profile?: boolean;
}

interface EventExhibitorsSectionProps {
  event: Event;
}

export const EventExhibitorsSection = ({ event }: EventExhibitorsSectionProps) => {
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedExhibitor, setSelectedExhibitor] = useState<Exhibitor | null>(null);
  const [showCrmModal, setShowCrmModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Force montage du composant pour éviter les problèmes de SSR/hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchExhibitors = async () => {
      try {
        console.log('🔍 EventExhibitorsSection - event.id:', event.id);
        console.log('🔍 EventExhibitorsSection - event.id_event:', event.id_event);
        console.log('🔍 EventExhibitorsSection - Current environment:', window.location.hostname);
        console.log('🔍 EventExhibitorsSection - Component mounted, loading:', loading);
        
        if (!event.id_event) {
          console.log('❌ Pas d\'id_event_text, arrêt du chargement');
          setLoading(false);
          return;
        }

        console.log('📤 Requête participations_with_exhibitors pour event.id_event (text):', event.id_event);
        
        // Requête principale avec id_event_text
        const { data, error } = await supabase
          .from('participations_with_exhibitors')
          .select('*')
          .eq('id_event_text', event.id_event);

        let exhibitorsData = data;

        // Fallback avec UUID pour compatibilité
        if (!exhibitorsData?.length && event.id) {
          console.log('🔄 Fallback: tentative avec id_event (UUID):', event.id);
          const { data: fallbackData } = await supabase
            .from('participations_with_exhibitors')
            .select('*')
            .eq('id_event', event.id);
          exhibitorsData = fallbackData ?? [];
        }

        // Console warn pour admin si mismatch détecté
        if (typeof window !== 'undefined' && window.location.hostname.includes('admin')) {
          const { data: checkData } = await supabase
            .from('participations_with_exhibitors')  
            .select('*')
            .eq('id_event_text', event.id_event);
          
          if ((checkData?.length || 0) > 0 && (!exhibitorsData?.length)) {
            console.warn('⚠️ ADMIN WARNING: id_event_text renvoie', checkData?.length, 'exposants mais UI affiche 0. Mismatch détecté!');
          }
        }

        if (error) {
          console.error('❌ Error fetching exhibitors:', error);
          setExhibitors([]);
        } else {
          console.log('✅ Données brutes de participations_with_exhibitors:', exhibitorsData);
          console.log('📤 Exposants chargés via VIEW:', exhibitorsData?.length || 0);
          
          // Tri alphabétique côté client sur exhibitor_name  
          const sortedData = (exhibitorsData || []).sort((a: any, b: any) => {
            const nameA = a.exhibitor_name || '';
            const nameB = b.exhibitor_name || '';
            return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
          });
          
          console.log('🔤 Premier exposant après tri:', sortedData[0]?.exhibitor_name);
          console.log('🔤 Dernier exposant après tri:', sortedData[sortedData.length - 1]?.exhibitor_name);
          
          const mappedExhibitors: Exhibitor[] = sortedData.map((participation: any) => {
            console.log('🔄 Mapping participation:', participation);
            return {
              nom_exposant: participation.exhibitor_name || participation.id_exposant || 'Exposant',
              stand_exposant: participation.stand_exposant,
              // Priorité au website de participation, fallback vers exposant
              website_exposant: participation.website_exposant || participation.exhibitor_website,
              exposant_description: participation.exposant_description,
              urlexpo_event: participation.urlexpo_event,
              has_exhibitor_profile: !!participation.exhibitor_uuid
            };
          });
          
          console.log('📋 Exposants finaux mappés et triés:', mappedExhibitors);
          setExhibitors(mappedExhibitors);
        }
      } catch (error) {
        console.error('Unexpected error fetching exhibitors:', error);
        setExhibitors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExhibitors();
  }, [event.id_event, event.id]); // Utilise id_event_text comme clé principale

  // Force l'affichage si le composant n'est pas monté (problème d'hydratation)
  if (!mounted) {
    console.log('❌ EventExhibitorsSection - Composant pas encore monté, affichage fallback');
    return (
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Exposants (chargement...)</h3>
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  console.log('🔍 EventExhibitorsSection - État actuel:', { 
    mounted, 
    loading, 
    exhibitorsCount: exhibitors.length,
    eventId: event.id,
    hostname: window.location.hostname 
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  // Si aucun exposant trouvé, affichage du placeholder
  if (exhibitors.length === 0) {
    console.log('📋 EventExhibitorsSection - Aucun exposant trouvé, affichage placeholder');
    console.log('🔍 Debug état final:', { 
      loading: false,
      mounted: true,
      exhibitors: exhibitors,
      rawEvent: event 
    });
    return (
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            Exposants
          </h3>
        </div>
        
        <p className="text-gray-500 italic">
          Aucun exposant trouvé pour cet événement
        </p>
      </div>
    );
  }

  // Slice selon showAll - limité à 9 exposants par défaut
  const toDisplay = showAll ? exhibitors : exhibitors.slice(0, 9);
  console.log('📋 EventExhibitorsSection - Affichage liste exposants, total:', exhibitors.length, 'affichés:', toDisplay.length);
  console.log('🔍 État final avant rendu liste:', { mounted, loading, exhibitorsLength: exhibitors.length });

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            Exposants ({exhibitors.length})
          </h3>
        </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {toDisplay.map((exhibitor, index) => (
          <button
            key={index}
            onClick={() => setSelectedExhibitor(exhibitor)}
            className="w-full text-left border rounded-lg p-4 hover:shadow-md hover:bg-gray-50 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{exhibitor.nom_exposant}</p>
                {exhibitor.stand_exposant && (
                  <p className="text-sm text-gray-600 mt-1">
                    Stand : {exhibitor.stand_exposant}
                  </p>
                )}
                {!exhibitor.has_exhibitor_profile && (
                  <p className="text-xs text-gray-500 mt-1 italic">Sans fiche exposant</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {exhibitors.length > 9 && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setShowAll(prev => !prev)}
          >
            {showAll ? 'Voir moins' : 'Afficher tout'}
          </Button>
        </div>
      )}

      {/* Modal avec Dialog */}
      <Dialog open={!!selectedExhibitor} onOpenChange={() => setSelectedExhibitor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedExhibitor?.nom_exposant}</DialogTitle>
            <DialogDescription>
              Informations détaillées sur cet exposant
            </DialogDescription>
          </DialogHeader>
          
          {selectedExhibitor && (
            <div className="space-y-4">
              {selectedExhibitor.stand_exposant && (
                <div>
                  <p className="font-semibold text-sm text-gray-600">Stand</p>
                  <p className="text-gray-900">{selectedExhibitor.stand_exposant}</p>
                </div>
              )}
              
              {selectedExhibitor.website_exposant && (
                <div>
                  <p className="font-semibold text-sm text-gray-600">Site web</p>
                  <a
                    href={selectedExhibitor.website_exposant.startsWith('http') 
                      ? selectedExhibitor.website_exposant 
                      : `https://${selectedExhibitor.website_exposant}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {selectedExhibitor.website_exposant}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              
              
              {selectedExhibitor.exposant_description && (
                <div>
                  <p className="font-semibold text-sm text-gray-600">Description</p>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    {selectedExhibitor.exposant_description}
                  </p>
                </div>
              )}
              
              {!selectedExhibitor.stand_exposant && !selectedExhibitor.website_exposant && 
               !selectedExhibitor.exposant_description && (
                <p className="text-gray-500 italic">
                  Aucune information supplémentaire disponible.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de connexion CRM */}
      <CrmConnectModal 
        open={showCrmModal} 
        onOpenChange={setShowCrmModal} 
      />
    </div>
  );
};
