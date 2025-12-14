import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event } from '@/types/event';
import { formatAffluence } from '@/utils/affluenceUtils';

interface SEOHeadProps {
  event: Event;
  noIndex?: boolean;
}

export const SEOHead = ({ event, noIndex = false }: SEOHeadProps) => {
  const formatDateShort = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  // ✅ AMÉLIORATION : Titre optimisé avec ville pour le local SEO
  const title = `${event.nom_event} – ${formatDateShort(event.date_debut)}${
    event.date_debut !== event.date_fin ? ` au ${formatDateShort(event.date_fin)}` : ''
  } – ${event.ville || 'France'}`;

  // ✅ AMÉLIORATION : Description enrichie avec affluence
  const description = `Découvrez les infos, exposants et contacts de l'événement ${event.nom_event}. ${
    event.affluence ? `${formatAffluence(event.affluence)} visiteurs attendus.` : ''
  } Du ${formatDateShort(event.date_debut)}${
    event.date_debut !== event.date_fin ? ` au ${formatDateShort(event.date_fin)}` : ''
  }.`;

  // ✅ AJOUT : URL canonique pour éviter le duplicate content
  const canonicalUrl = `https://lotexpo.com/events/${event.slug}`;

  // ✅ AMÉLIORATION : JSON-LD enrichi avec organizer et offers
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.nom_event,
    "startDate": event.date_debut,
    "endDate": event.date_fin,
    "location": {
      "@type": "Place",
      "name": event.nom_lieu || event.ville,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": event.rue || undefined,
        "addressLocality": event.ville,
        "postalCode": event.code_postal || undefined,
        "addressCountry": event.country || "France"
      }
    },
    "description": event.description_event || description,
    "url": canonicalUrl,
    "image": event.url_image,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    // ✅ AJOUT : Organisateur pour Google
    "organizer": {
      "@type": "Organization",
      "name": event.nom_lieu || "Organisateur",
      "url": event.url_site_officiel || undefined
    },
    // ✅ AMÉLIORATION : Offre avec plus de détails
    "offers": event.tarif ? {
      "@type": "Offer",
      "description": event.tarif,
      "url": event.url_site_officiel || canonicalUrl,
      "availability": "https://schema.org/InStock"
    } : undefined
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* ✅ AJOUT : Balise canonical pour éviter le duplicate content */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* ✅ AMÉLIORATION : Open Graph complet */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Lotexpo" />
      <meta property="og:locale" content="fr_FR" />
      {event.url_image && <meta property="og:image" content={event.url_image} />}
      
      {/* ✅ AMÉLIORATION : Twitter Cards complet */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@lotexpo" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {event.url_image && <meta name="twitter:image" content={event.url_image} />}
      
      {/* JSON-LD enrichi */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
    </Helmet>
  );
};
