
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import type { Event } from '@/types/event';

interface EventDescriptionProps {
  event: Event;
}

export const EventDescription = ({ event }: EventDescriptionProps) => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2 text-accent" />
          À propos de l'événement
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose max-w-none">
          {event.description ? (
            <p className="text-gray-700 leading-relaxed">{event.description}</p>
          ) : (
            <p className="text-gray-700 leading-relaxed">
              Découvrez {event.name}, un événement incontournable du secteur {event.sector.toLowerCase()}.
              Retrouvez les dernières innovations, rencontrez les professionnels du secteur et développez votre réseau.
            </p>
          )}
        </div>

        {event.estimated_visitors && (
          <div className="mt-4 p-3 bg-accent/10 rounded-lg">
            <p className="text-accent font-semibold">
              {event.estimated_visitors.toLocaleString('fr-FR')} visiteurs attendus
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
