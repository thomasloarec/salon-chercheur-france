import React, { useState } from 'react';
import { MapPin, Map, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEnv } from '@/lib/env';
import DOMPurify from 'dompurify';
import type { Event } from '@/types/event';

interface EventAboutSidebarProps {
  event: Event;
}

const sanitize = (dirtyHtml: string) => {
  return DOMPurify.sanitize(dirtyHtml, { 
    ADD_TAGS: ['mark'],
    FORBID_ATTR: ['style']
  });
};

export default function EventAboutSidebar({ event }: EventAboutSidebarProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const apiKey = getEnv('VITE_GOOGLE_MAPS_API_KEY') || getEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  const hasCoordinates = typeof (event as any).latitude === 'number' && typeof (event as any).longitude === 'number';

  const formatAddress = () => {
    const parts = [
      event.rue,
      event.code_postal && event.ville ? `${event.code_postal} ${event.ville}` : event.ville || event.code_postal,
      event.country
    ].filter(Boolean);
    
    return parts.join(', ') || 'Adresse non renseignée';
  };

  const defaultDescription = `Découvrez ${event.nom_event}, un événement incontournable du secteur ${event.secteur?.toLowerCase() || ''}. 
    Retrouvez les dernières innovations, rencontrez les professionnels du secteur et développez votre réseau.`;

  const description = event.description_event || defaultDescription;
  const descriptionPreview = description.slice(0, 150);
  const needsExpansion = description.length > 150;

  return (
    <div className="rounded-xl border bg-card p-4 md:p-5 space-y-5">
      <h3 className="font-semibold text-lg">À propos de l'événement</h3>

      {/* Description */}
      <section>
        <div
          className="prose prose-sm max-w-none text-muted-foreground leading-relaxed text-left [&_*]:text-left"
          dangerouslySetInnerHTML={{
            __html: sanitize(
              showFullDescription || !needsExpansion
                ? description
                : descriptionPreview + '...'
            )
          }}
        />
        {needsExpansion && (
          <Button
            variant="link"
            size="sm"
            className="p-0 h-auto mt-1 text-primary"
            onClick={() => setShowFullDescription(!showFullDescription)}
          >
            {showFullDescription ? 'Voir moins' : 'Voir plus...'}
          </Button>
        )}
      </section>

      {/* Tarifs */}
      <div className="pt-4 border-t">
        <div className="flex items-start gap-2">
          <Euro size={18} className="mt-0.5 text-orange-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">Tarifs</p>
            <p className="text-sm text-muted-foreground">{event.tarif || '—'}</p>
          </div>
        </div>
      </div>

      {/* Adresse */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-orange-500" />
          <h4 className="font-medium text-sm">Adresse</h4>
        </div>
        <div className="text-sm text-muted-foreground">
          <div>{formatAddress()}</div>
        </div>
      </section>

      {/* Localisation (carte) */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Map className="h-4 w-4 text-orange-500" />
          <h4 className="font-medium text-sm">Localisation</h4>
        </div>
        {apiKey && hasCoordinates ? (
          <iframe
            title="Localisation"
            width="100%"
            height="260"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${(event as any).latitude},${(event as any).longitude}`}
            className="rounded-lg"
          />
        ) : (
          <div className="rounded-lg border bg-muted/30 text-muted-foreground p-4 text-sm">
            Carte indisponible
            {!hasCoordinates && <div className="text-xs mt-1">Coordonnées GPS manquantes</div>}
          </div>
        )}
      </section>
    </div>
  );
}
