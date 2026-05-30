import { Helmet } from 'react-helmet-async';
import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';

// Site-wide OG fallback, identical to the one used by GlobalSEO.tsx.
const OG_IMAGE_FALLBACK = 'https://lotexpo.com/favicon.png';

interface ExhibitorProfileSEOProps {
  profile: PublicExhibitorProfile;
}

/**
 * SEO head for the public exhibitor profile page.
 * - robots: index/follow when seo_indexable, otherwise noindex/follow.
 * - canonical: https://lotexpo.com/exposants/{public_slug}
 * - Open Graph: logo_url when available, else the site-wide OG fallback.
 * (Test profiles never reach this component — the page returns a 404.)
 */
export const ExhibitorProfileSEO = ({ profile }: ExhibitorProfileSEOProps) => {
  const name = profile.display_name || profile.canonical_name || 'Exposant';
  const slug = profile.public_slug || '';

  const title =
    `${name} : salons, nouveautés et événements professionnels | Lotexpo`.slice(0, 70);

  const description = (
    profile.description
      ? `Retrouvez les salons professionnels, nouveautés et informations publiques de ${name} sur Lotexpo.`
      : `Consultez la fiche exposant de ${name} sur Lotexpo : salons professionnels associés, nouveautés et informations publiques.`
  ).slice(0, 160);

  const canonicalUrl = `https://lotexpo.com/exposants/${slug}`;
  const ogImage = profile.logo_url || OG_IMAGE_FALLBACK;
  const indexable = profile.seo_indexable === true;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={indexable ? 'index, follow' : 'noindex, follow'}
      />

      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Lotexpo" />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:image" content={ogImage} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@lotexpo" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default ExhibitorProfileSEO;