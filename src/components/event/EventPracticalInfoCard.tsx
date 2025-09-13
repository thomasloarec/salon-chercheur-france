import React from 'react';
import { Building2, MapPin, Map } from 'lucide-react';
import { getEnv } from '@/lib/env';
import type { Event } from '@/types/event';

interface EventPracticalInfoCardProps {
  event: Event;
}

export default function EventPracticalInfoCard({ event }: EventPracticalInfoCardProps) {
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

  return (
    <div className="rounded-xl border bg-card p-4 md:p-5 space-y-5">
      {/* Nom du lieu */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-orange-500" />
          <h3 className="font-medium">Nom du lieu</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {event.nom_lieu?.trim() || 'Lieu non renseigné'}
        </p>
      </section>

      {/* Adresse */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-orange-500" />
          <h3 className="font-medium">Adresse</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          <div>{formatAddress()}</div>
        </div>
      </section>

      {/* Localisation (carte) */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Map className="h-4 w-4 text-orange-500" />
          <h3 className="font-medium">Localisation</h3>
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