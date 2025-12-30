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
  const currentYear = new Date().getFullYear();
  
  const formatDateShort = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: fr });
  };

  // Optimized title: {{Nom de l'événement}} {{Année}} | Salon professionnel à {{Ville}} – Lotexpo
  // Max 60 chars, keyword first, brand suffix
  const eventYear = event.date_debut ? new Date(event.date_debut).getFullYear() : currentYear;
  const title = `${event.nom_event} ${eventYear} | Salon professionnel à ${event.ville || 'France'} – Lotexpo`.slice(0, 60);

  // Optimized description: max 160 chars, action-oriented
  const description = `${event.nom_event} à ${event.ville || 'France'} : dates, exposants, secteurs représentés et informations pratiques pour préparer votre visite professionnelle.`.slice(0, 160);

  // Canonical URL
  const canonicalUrl = `https://www.lotexpo.com/events/${event.slug}`;

  // Enhanced JSON-LD Event schema
  const eventSchema = {
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
    "organizer": {
      "@type": "Organization",
      "name": event.nom_lieu || "Organisateur",
      "url": event.url_site_officiel || undefined
    },
    "offers": event.tarif ? {
      "@type": "Offer",
      "description": event.tarif,
      "url": event.url_site_officiel || canonicalUrl,
      "availability": "https://schema.org/InStock"
    } : undefined
  };

  // Breadcrumb schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://www.lotexpo.com" },
      { "@type": "ListItem", "position": 2, "name": "Salons professionnels", "item": "https://www.lotexpo.com" },
      { "@type": "ListItem", "position": 3, "name": event.nom_event, "item": canonicalUrl }
    ]
  };

  // WebSite schema for consistent site name
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Lotexpo",
    "url": "https://www.lotexpo.com"
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Lotexpo" />
      <meta property="og:locale" content="fr_FR" />
      {event.url_image && <meta property="og:image" content={event.url_image} />}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@lotexpo" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {event.url_image && <meta name="twitter:image" content={event.url_image} />}
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(eventSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
    </Helmet>
  );
};
