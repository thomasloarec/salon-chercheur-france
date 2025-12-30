import { Helmet } from 'react-helmet-async';

interface GlobalSEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  noIndex?: boolean;
}

/**
 * Global SEO component that provides:
 * - WebSite schema.org markup for site name
 * - Default meta tags
 * - Canonical URL handling
 */
export const GlobalSEO = ({ 
  title = "Lotexpo | Tous les salons professionnels en France",
  description = "Lotexpo référence tous les salons professionnels B2B en France. Dates, lieux, secteurs, exposants et informations pratiques en un seul site.",
  canonical,
  noIndex = false
}: GlobalSEOProps) => {
  const canonicalUrl = canonical || 'https://www.lotexpo.com';
  
  // WebSite schema for Google site name
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
      <meta property="og:image" content="https://www.lotexpo.com/favicon.png" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@lotexpo" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      
      {/* WebSite Schema for Google site name */}
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
    </Helmet>
  );
};

export default GlobalSEO;
