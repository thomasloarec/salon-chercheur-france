
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';

interface SEOHeadProps {
  event: Event;
  noIndex?: boolean;
}

export const SEOHead = ({ event, noIndex = false }: SEOHeadProps) => {
  const formatDateShort = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  const title = `${event.name_event} – ${formatDateShort(event.date_debut)}${
    event.date_debut !== event.date_fin ? ` au ${formatDateShort(event.date_fin)}` : ''
  } – ${event.ville}`;

  const description = `Découvrez les infos, exposants et contacts de l'événement ${event.name_event}. ${
    event.affluence ? `${event.affluence.toLocaleString('fr-FR')} visiteurs attendus.` : ''
  } Du ${formatDateShort(event.date_debut)}${
    event.date_debut !== event.date_fin ? ` au ${formatDateShort(event.date_fin)}` : ''
  }.`;

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.name_event,
    "startDate": event.date_debut,
    "endDate": event.date_fin,
    "location": {
      "@type": "Place",
      "name": event.nom_lieu,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": event.ville,
        "addressRegion": event.region,
        "addressCountry": event.country || "France"
      }
    },
    "description": event.description_event,
    "url": event.url_site_officiel,
    "image": event.url_image,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "offers": event.tarif ? {
      "@type": "Offer",
      "description": event.tarif,
      "url": event.url_site_officiel
    } : undefined
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {event.url_image && <meta property="og:image" content={event.url_image} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {event.url_image && <meta name="twitter:image" content={event.url_image} />}
      
      {/* JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
    </Helmet>
  );
};
