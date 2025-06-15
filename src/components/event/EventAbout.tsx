
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, Euro } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventAboutProps {
  event: Event;
}

export const EventAbout = ({ event }: EventAboutProps) => {
  return (
    <Card className="mb-8">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl">
          <h2 className="flex items-center">
            <FileText className="h-6 w-6 mr-3 text-accent" />
            À propos de l'événement
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Description */}
        <div>
          <p className="text-gray-700 leading-relaxed text-base text-left">
            {event.description || (
              `Découvrez ${event.name}, un événement incontournable du secteur ${event.sector.toLowerCase()}. 
              Retrouvez les dernières innovations, rencontrez les professionnels du secteur et développez votre réseau.`
            )}
          </p>
        </div>

        {/* Informations structurées */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
          {/* Affluence */}
          {event.estimated_visitors && (
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-accent flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900">Affluence</h3>
                <p className="text-gray-600">
                  {event.estimated_visitors.toLocaleString('fr-FR')} visiteurs attendus
                </p>
              </div>
            </div>
          )}

          {/* Tarifs */}
          {event.entry_fee && (
            <div className="flex items-center space-x-3">
              <Euro className="h-5 w-5 text-accent flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900">Tarifs</h3>
                <p className="text-gray-600">{event.entry_fee}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
