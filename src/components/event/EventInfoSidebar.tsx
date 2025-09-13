import React from 'react';
import { Calendar, MapPin, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateRange } from '@/utils/dateUtils';
import type { Event } from '@/types/event';

interface EventInfoSidebarProps {
  event: Event;
}

export default function EventInfoSidebar({ event }: EventInfoSidebarProps) {
  const hasLocation = event.nom_lieu || event.rue || event.ville;
  // Note: No coordinates available in current Event type
  const hasCoordinates = false;
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const formatAddress = () => {
    const parts = [
      event.nom_lieu,
      event.rue,
      event.code_postal && event.ville ? `${event.code_postal} ${event.ville}` : event.ville || event.code_postal,
      event.country
    ].filter(Boolean);
    
    return parts.join(', ');
  };

  const formatEventDate = (dateDebut: string, dateFin?: string) => {
    if (!dateFin || dateDebut === dateFin) {
      return new Date(dateDebut).toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
    }
    return formatDateRange(dateDebut, dateFin);
  };

  const generateCalendarLink = (type: 'google' | 'outlook') => {
    const title = encodeURIComponent(event.nom_event || '');
    const details = encodeURIComponent(`Événement: ${event.nom_event || ''}\n${event.url_site_officiel ? `Site web: ${event.url_site_officiel}` : ''}`);
    const location = encodeURIComponent(formatAddress());
    const startDate = event.date_debut ? new Date(event.date_debut).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : '';
    const endDate = event.date_fin ? new Date(event.date_fin).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : startDate;

    if (type === 'google') {
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
    } else {
      return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${details}&location=${location}`;
    }
  };

  return (
    <div className="sticky top-24 max-h-[75vh] overflow-y-auto space-y-4">
      {/* Event Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            asChild
          >
            <a href={generateCalendarLink('google')} target="_blank" rel="noopener noreferrer">
              <Calendar className="w-4 h-4 mr-2" />
              Ajouter à Google Calendar
            </a>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            asChild
          >
            <a href={generateCalendarLink('outlook')} target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4 mr-2" />
              Télécharger .ics
            </a>
          </Button>

          {event.url_site_officiel && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              asChild
            >
              <a href={event.url_site_officiel} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Site officiel
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Event Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dates */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Dates</p>
              <p className="text-sm text-muted-foreground">
                {event.date_debut && formatEventDate(event.date_debut, event.date_fin)}
              </p>
            </div>
          </div>

          {/* Location */}
          {hasLocation && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Lieu</p>
                <p className="text-sm text-muted-foreground">
                  {formatAddress()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map - Currently not available as coordinates are not in Event type */}
      {hasLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Localisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video rounded-lg overflow-hidden border bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Carte indisponible</p>
                <p className="text-xs text-gray-400">Coordonnées GPS manquantes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}