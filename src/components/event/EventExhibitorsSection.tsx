
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
      console.log('🔍 EventExhibitorsSection - event.id_event:', event.id_event);
      console.log('🔍 EventExhibitorsSection - Current environment:', window.location.hostname);
      console.log('🔍 EventExhibitorsSection - Component mounted, loading:', loading);
      
      if (!event.id_event) {
        console.log('❌ Pas d\'id_event, arrêt du chargement');
        setLoading(false);
        return;
      }

      try {
        console.log('📤 Requête participation pour id_event:', event.id_event);
        console.log('🔍 Type et valeur de event.id_event:', typeof event.id_event, JSON.stringify(event.id_event));
        
        // Nouvelle requête utilisant la table participation avec jointure
        // Utiliser le client anonyme pour éviter les restrictions RLS
        const { data, error } = await supabase
          .from('participation')
          .select(`
            stand_exposant,
            website_exposant,
            urlexpo_event,
            exposants!inner (
              nom_exposant,
              website_exposant,
              exposant_description
            )
          `)
          .eq('id_event', event.id_event);

        if (error) {
          console.error('❌ Error fetching exhibitors:', error);
          setExhibitors([]);
        } else {
          console.log('✅ Données brutes de participation:', data);
          console.log('📤 Exposants chargés via participation:', data?.length || 0);
          
          const mappedExhibitors: Exhibitor[] = (data || []).map((participation: any) => {
            console.log('🔄 Mapping participation:', participation);
            const exposant = participation.exposants;
            return {
              nom_exposant: exposant.nom_exposant || 'Nom non disponible',
              stand_exposant: participation.stand_exposant,
              // Priorité au website de participation, fallback vers exposant
              website_exposant: participation.website_exposant || exposant.website_exposant,
              exposant_description: exposant.exposant_description,
              urlexpo_event: participation.urlexpo_event
            };
          });
          
          // Tri alphabétique par nom_exposant
          const sortedExhibitors = mappedExhibitors.sort((a, b) => 
            a.nom_exposant.localeCompare(b.nom_exposant)
          );
          
          console.log('📋 Exposants finaux mappés et triés:', sortedExhibitors);
          setExhibitors(sortedExhibitors);
        }
      } catch (error) {
        console.error('Unexpected error fetching exhibitors:', error);
        setExhibitors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExhibitors();
  }, [event.id_event]); // Utilise la clé métier, pas l'UUID

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
    eventId: event.id_event,
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
            Exposants (Debug: mounted={mounted.toString()}, loading={loading.toString()})
          </h3>
          <Button 
            className="bg-accent hover:bg-accent/90"
            onClick={() => setShowCrmModal(true)}
          >
            <Link className="h-4 w-4 mr-2" />
            Connecter mon CRM
          </Button>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            💡 <strong>Conseil :</strong> Connectez votre CRM pour découvrir facilement vos prospects parmi les exposants.
          </p>
        </div>
        
        <p className="text-gray-500 italic">
          Exposants inconnus pour cet événement
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
          Exposants ({exhibitors.length}) - Debug: {window.location.hostname}
        </h3>
        <Button 
          className="bg-accent hover:bg-accent/90"
          onClick={() => setShowCrmModal(true)}
        >
          <Link className="h-4 w-4 mr-2" />
          Connecter mon CRM
        </Button>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm">
          💡 <strong>Conseil :</strong> Connectez votre CRM pour découvrir facilement vos prospects parmi les exposants.
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {toDisplay.map((exhibitor, index) => (
          <button
            key={index}
            onClick={() => setSelectedExhibitor(exhibitor)}
            className="w-full text-left border rounded-lg p-4 hover:shadow-md hover:bg-gray-50 transition-all"
          >
            <p className="font-medium text-gray-900">{exhibitor.nom_exposant}</p>
            {exhibitor.stand_exposant && (
              <p className="text-sm text-gray-600 mt-1">
                Stand : {exhibitor.stand_exposant}
              </p>
            )}
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
