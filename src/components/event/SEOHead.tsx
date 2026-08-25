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

  // Detect past event – compare ISO date strings (YYYY-MM-DD) to avoid
  // timezone issues where the last day would already show as "[Terminé]"
  const todayStr = new Date().toISOString().slice(0, 10);
  const endStr = event.date_fin?.slice(0, 10) ?? event.date_debut?.slice(0, 10) ?? null;
  const isEventPast = endStr ? endStr < todayStr : false;

  // Optimized title: {{Nom de l'événement}} {{Année}} | Salon professionnel à {{Ville}} – Lotexpo
  // Max 60 chars, keyword first, brand suffix
  const eventYear = event.date_debut ? new Date(event.date_debut).getFullYear() : currentYear;
  // Avoid duplicating the year when the event name already contains it
  // (e.g. "SIDO 2026" would otherwise become "SIDO 2026 2026 | ...").
  const nameHasYear = new RegExp(`\\b${eventYear}\\b`).test(event.nom_event || '');
  const namePart = nameHasYear ? event.nom_event : `${event.nom_event} ${eventYear}`;
  const baseTitle = `${namePart} | Salon professionnel à ${event.ville || 'France'} – Lotexpo`.slice(0, 60);
  const title = isEventPast ? `[Terminé] ${baseTitle}`.slice(0, 60) : baseTitle;

  // Optimized description: prefer generated meta if available, otherwise fallback
  const description = (event.meta_description_gen || 
    `${event.nom_event} à ${event.ville || 'France'} : dates, exposants, secteurs représentés et informations pratiques pour préparer votre visite professionnelle.`
  ).slice(0, 160);

  // Canonical URL
  const canonicalUrl = `https://lotexpo.com/events/${event.slug}`;


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
      
      {/* JSON-LD retire volontairement : source unique = prerender (Event +
          BreadcrumbList via buildEvent) et shell index.html (WebSite +
          Organization). react-helmet ne peut pas dedupliquer les scripts JSON-LD
          statiques du prerender, donc les emettre ici creait des doublons
          Event / Breadcrumb / WebSite dans le DOM rendu. Title, meta, canonical,
          og et twitter restent geres ici. */}
    </Helmet>
  );
};
