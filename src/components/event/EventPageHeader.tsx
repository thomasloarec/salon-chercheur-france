
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import CalBtn from '@/components/CalBtn';
import type { Event } from '@/types/event';

interface EventPageHeaderProps {
  event: Event;
  crmProspects?: Array<{ name: string; stand?: string }>;
}

export const EventPageHeader = ({ event, crmProspects = [] }: EventPageHeaderProps) => {
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
  };

  return (
    <section className="bg-white rounded-lg shadow-sm p-8 mb-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Contenu principal */}
        <div className="space-y-6">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {event.sector}
            </Badge>
            {event.tags?.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-sm px-3 py-1">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Titre principal */}
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight text-left">
              {event.name}
            </h1>
          </div>

          {/* Date */}
          <div className="flex items-center text-lg text-gray-600">
            <CalendarDays className="h-6 w-6 mr-3 text-accent" />
            <span className="font-medium">
              {formatDate(event.start_date)}
              {event.start_date !== event.end_date && (
                <> - {formatDate(event.end_date)}</>
              )}
            </span>
          </div>

          {/* Séparateur */}
          <Separator className="my-4" />

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Boutons calendrier avec texte explicatif */}
              <div className="flex flex-col">
                <div className="flex gap-2">
                  <CalBtn type="gcal" event={event} crmProspects={crmProspects} />
                  <CalBtn type="outlook" event={event} crmProspects={crmProspects} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajoutez cet événement à votre agenda en un clic.
                </p>
              </div>
              
              {/* Bouton site officiel */}
              {event.event_url && (
                <Button 
                  variant="outline"
                  onClick={() => window.open(event.event_url, '_blank')}
                  className="text-sm self-start"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Site officiel
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Image de l'événement */}
        {event.image_url && (
          <div className="flex-shrink-0 overflow-hidden">
            <img
              src={event.image_url}
              alt={`Affiche de ${event.name}`}
              loading="lazy"
              className="max-h-full w-auto object-contain rounded-md shadow-lg"
            />
          </div>
        )}
      </div>
    </section>
  );
};
