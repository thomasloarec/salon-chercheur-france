
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';

interface SEOHeadProps {
  event: Event;
}

export const SEOHead = ({ event }: SEOHeadProps) => {
  const formatDateShort = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  const title = `${event.name} – ${formatDateShort(event.start_date)}${
    event.start_date !== event.end_date ? ` au ${formatDateShort(event.end_date)}` : ''
  } – ${event.city}`;

  const description = `Découvrez les infos, exposants et contacts de l'événement ${event.name}. ${
    event.estimated_visitors ? `${event.estimated_visitors.toLocaleString('fr-FR')} visiteurs attendus.` : ''
  } Du ${formatDateShort(event.start_date)}${
    event.start_date !== event.end_date ? ` au ${formatDateShort(event.end_date)}` : ''
  }.`;

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.name,
    "startDate": event.start_date,
    "endDate": event.end_date,
    "location": {
      "@type": "Place",
      "name": event.venue_name || event.location,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": event.city,
        "addressRegion": event.region,
        "addressCountry": event.country || "France"
      }
    },
    "organizer": event.organizer_name ? {
      "@type": "Organization",
      "name": event.organizer_name
    } : undefined,
    "description": event.description,
    "url": event.event_url,
    "image": event.image_url,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "offers": event.entry_fee ? {
      "@type": "Offer",
      "description": event.entry_fee,
      "url": event.event_url
    } : undefined
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {event.image_url && <meta property="og:image" content={event.image_url} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {event.image_url && <meta name="twitter:image" content={event.image_url} />}
      
      {/* JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
    </Helmet>
  );
};
