import React from 'react';
import { MapPin, Map, Euro } from 'lucide-react';
import { getEnv } from '@/lib/env';
import type { Event } from '@/types/event';
import EventMapEmbed from '@/components/maps/EventMapEmbed';

interface EventAboutSidebarProps {
  event: Event;
}

export default function EventAboutSidebar({ event }: EventAboutSidebarProps) {
  const formatAddress = () => {
    const parts = [
      event.nom_lieu,
      event.rue,
      event.code_postal && event.ville ? `${event.code_postal} ${event.ville}` : event.ville || event.code_postal,
      event.country || 'France'
    ].filter(Boolean);
    
    return parts.join(', ') || null;
  };

  const address = formatAddress();

  return (
    <aside className="rounded-xl border bg-card p-4 md:p-5 space-y-5" aria-label="Informations pratiques">
      <h2 className="font-semibold text-lg">À propos de l'événement</h2>

      {/* Tarif */}
      <div className="pt-4 border-t">
        <div className="flex items-start gap-2">
          <Euro size={18} className="mt-0.5 text-orange-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">Tarif</p>
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
          <div>{address || 'Adresse non renseignée'}</div>
        </div>
      </section>

      {/* Localisation (carte) */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Map className="h-4 w-4 text-orange-500" />
          <h4 className="font-medium text-sm">Localisation</h4>
        </div>
        <EventMapEmbed 
          address={address}
          height={260}
          className="w-full"
        />
      </section>
    </aside>
  );
}