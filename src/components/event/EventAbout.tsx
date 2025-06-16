
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, Euro, Calendar } from 'lucide-react';
import { getEventTypeLabel } from '@/constants/eventTypes';
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

        {/* Sous-catégories : Type | Affluence | Tarifs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 sm:gap-y-0 sm:gap-x-10 pt-4 border-t">
          {/* Type */}
          <div className="flex items-start gap-2">
            <Calendar size={18} className="mt-0.5 text-orange-500" />
            <div>
              <p className="font-medium">Type</p>
              <p className="text-gray-600">{getEventTypeLabel(event.event_type)}</p>
            </div>
          </div>

          {/* Affluence */}
          <div className="flex items-start gap-2">
            <Users size={18} className="mt-0.5 text-orange-500" />
            <div>
              <p className="font-medium">Affluence</p>
              <p className="text-gray-600">
                {event.estimated_visitors 
                  ? `${event.estimated_visitors.toLocaleString('fr-FR')} visiteurs attendus` 
                  : '—'
                }
              </p>
            </div>
          </div>

          {/* Tarifs */}
          <div className="flex items-start gap-2">
            <Euro size={18} className="mt-0.5 text-orange-500" />
            <div>
              <p className="font-medium">Tarifs</p>
              <p className="text-gray-600">{event.entry_fee || '—'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
