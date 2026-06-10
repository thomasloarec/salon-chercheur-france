import { Helmet } from 'react-helmet-async';
import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';
import {
  normalizeExternalUrl,
  normalizeImageUrl,
  normalizeLinkedInUrl,
} from '@/lib/urlUtils';
import { cleanAiDescription } from '@/lib/exhibitorDescription';

// Dedicated 1200x630 Open Graph fallback for exhibitor pages.
// Always used for og:image (never the company logo) so social previews
// (LinkedIn, etc.) get a proper landscape card. The company logo is only
// used inside the page and in the JSON-LD `logo` field.
const OG_IMAGE_FALLBACK = 'https://lotexpo.com/og-exhibitor-default.png';

interface ExhibitorProfileSEOProps {
  profile: PublicExhibitorProfile;
}

/** Returns a trimmed string, or null when empty / whitespace-only / nullish. */
function cleanStr(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Builds a schema.org Organization JSON-LD object for an indexable exhibitor
 * profile. Returns null when the profile is not eligible (handled by caller).
 * Only public, non-sensitive fields are included; null/empty fields are
 * omitted entirely so the output never contains `undefined`.
 */
function buildOrganizationJsonLd(profile: PublicExhibitorProfile) {
  const slug = cleanStr(profile.public_slug);
  const name = cleanStr(profile.display_name);
  if (!slug || !name) return null;

  const canonicalUrl = `https://lotexpo.com/exposants/${slug}`;
  // Normalize every external URL before injecting it into structured data.
  const website = normalizeExternalUrl(profile.website);
  const logo = normalizeImageUrl(profile.logo_url);
  const linkedin = normalizeLinkedInUrl(profile.linkedin_url);
  const description =
    cleanAiDescription(profile.description) || cleanAiDescription(profile.ai_summary);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': canonicalUrl,
    name,
    mainEntityOfPage: canonicalUrl,
  };

  // `url` = official company website (never the Lotexpo URL).
  if (website) jsonLd.url = website;
  if (logo) jsonLd.logo = logo;
  if (description) jsonLd.description = description;

  // `sameAs` = external identity URLs. Avoid duplicating the website that is
  // already used as `url`.
  const sameAs = [linkedin].filter(
    (u): u is string => !!u && u !== website,
  );
  if (sameAs.length > 0) jsonLd.sameAs = sameAs;

  return jsonLd;
}

/**
 * Builds a schema.org BreadcrumbList JSON-LD object for an indexable exhibitor
 * profile: Salons > Exposants > {display_name}.
 * Returns null when the profile lacks a usable slug/name (handled by caller).
 * Only public, non-sensitive fields are included — no internal identifiers,
 * no seo_reason, never `undefined`.
 */
function buildBreadcrumbJsonLd(profile: PublicExhibitorProfile) {
  const slug = cleanStr(profile.public_slug);
  const name = cleanStr(profile.display_name) || cleanStr(profile.canonical_name);
  if (!slug || !name) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Salons',
        item: 'https://lotexpo.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Exposants',
        item: 'https://lotexpo.com/exposants',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name,
        item: `https://lotexpo.com/exposants/${slug}`,
      },
    ],
  };
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
    cleanAiDescription(profile.description)
      ? `Retrouvez les salons professionnels, nouveautés et informations publiques de ${name} sur Lotexpo.`
      : `Consultez la fiche exposant de ${name} sur Lotexpo : salons professionnels associés, nouveautés et informations publiques.`
  ).slice(0, 160);

  const canonicalUrl = `https://lotexpo.com/exposants/${slug}`;
  const indexable = profile.seo_indexable === true;
  // og:image is ALWAYS the dedicated landscape fallback — never the company
  // logo (logos are often square/transparent and preview poorly).
  const ogImage = OG_IMAGE_FALLBACK;

  // JSON-LD only for indexable profiles with a usable name — we don't emit
  // structured signals for noindex / thin-content pages.
  const organizationJsonLd =
    indexable && cleanStr(name) ? buildOrganizationJsonLd(profile) : null;

  // BreadcrumbList only for indexable profiles — coexists with Organization,
  // never emitted for noindex / thin-content pages.
  const breadcrumbJsonLd =
    indexable && cleanStr(name) ? buildBreadcrumbJsonLd(profile) : null;

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
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@lotexpo" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD Organization (indexable profiles only) */}
      {organizationJsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(organizationJsonLd)}
        </script>
      )}

      {/* JSON-LD BreadcrumbList (indexable profiles only) */}
      {breadcrumbJsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      )}
    </Helmet>
  );
};

export default ExhibitorProfileSEO;