
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
import { ExternalLink } from 'lucide-react';
import type { Event } from '@/types/event';

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

  useEffect(() => {
    const fetchExhibitors = async () => {
      if (!event.id) {
        setLoading(false);
        return;
      }

      try {
        // Nouvelle requête utilisant la table participation avec jointure
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
          console.error('Error fetching exhibitors:', error);
          setExhibitors([]);
        } else {
          console.log('📤 Exposants chargés via participation:', data?.length || 0);
          
          const mappedExhibitors: Exhibitor[] = (data || []).map((participation: any) => {
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
  }, [event.id]);

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
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center">
          Exposants
        </h3>
        <p className="text-gray-500 italic">
          Exposants inconnus pour cet événement
        </p>
      </div>
    );
  }

  // Slice selon showAll - limité à 9 exposants par défaut
  const toDisplay = showAll ? exhibitors : exhibitors.slice(0, 9);

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-xl font-semibold">
        Exposants ({exhibitors.length})
      </h3>
      
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
              
              {selectedExhibitor.urlexpo_event && (
                <div>
                  <p className="font-semibold text-sm text-gray-600">Page événement</p>
                  <a
                    href={selectedExhibitor.urlexpo_event.startsWith('http') 
                      ? selectedExhibitor.urlexpo_event 
                      : `https://${selectedExhibitor.urlexpo_event}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Voir sur le site
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
               !selectedExhibitor.urlexpo_event && !selectedExhibitor.exposant_description && (
                <p className="text-gray-500 italic">
                  Aucune information supplémentaire disponible.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
