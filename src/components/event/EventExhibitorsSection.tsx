import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EventExhibitors } from './EventExhibitors';
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
  name: string;
  stand?: string;
  website?: string;
  description?: string;
}

interface RawExhibitor {
  exposant_nom: string;
  exposant_stand?: string;
  exposant_website?: string;
  exposant_description?: string;
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
        // Fetch exposants sans aucune condition de filtrage sur le statut
        let { data, error } = await supabase
          .from('exposants')
          .select('*')
          .eq('id_event', event.id_event || event.id);

        // Si pas de résultats avec id_event, essayer avec l'id principal
        if ((!data || data.length === 0) && event.id_event) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('exposants')
            .select('*')
            .eq('id_event', event.id);
          
          if (!fallbackError) {
            data = fallbackData;
            error = fallbackError;
          }
        }

        if (error) {
          console.error('Error fetching exhibitors:', error);
          setExhibitors([]);
        } else {
          console.log('📤 Exposants chargés:', data?.length || 0);
          
          const mappedExhibitors: Exhibitor[] = (data || []).map((exp: RawExhibitor) => ({
            name: exp.exposant_nom || 'Nom non disponible',
            stand: exp.exposant_stand || undefined,
            website: exp.exposant_website || undefined,
            description: exp.exposant_description || undefined
          }));
          
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
  }, [event.id, event.id_event]);

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

  // Slice selon showAll - changed from 7 to 9
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
            <p className="font-medium text-gray-900">{exhibitor.name}</p>
            {exhibitor.stand && (
              <p className="text-sm text-gray-600 mt-1">
                Stand : {exhibitor.stand}
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
            <DialogTitle>{selectedExhibitor?.name}</DialogTitle>
            <DialogDescription>
              Informations détaillées sur cet exposant
            </DialogDescription>
          </DialogHeader>
          
          {selectedExhibitor && (
            <div className="space-y-4">
              {selectedExhibitor.stand && (
                <div>
                  <p className="font-semibold text-sm text-gray-600">Stand</p>
                  <p className="text-gray-900">{selectedExhibitor.stand}</p>
                </div>
              )}
              
              {selectedExhibitor.website && (
                <div>
                  <p className="font-semibold text-sm text-gray-600">Site web</p>
                  <a
                    href={selectedExhibitor.website.startsWith('http') 
                      ? selectedExhibitor.website 
                      : `https://${selectedExhibitor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {selectedExhibitor.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              
              {selectedExhibitor.description && (
                <div>
                  <p className="font-semibold text-sm text-gray-600">Description</p>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    {selectedExhibitor.description}
                  </p>
                </div>
              )}
              
              {!selectedExhibitor.stand && !selectedExhibitor.website && !selectedExhibitor.description && (
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
