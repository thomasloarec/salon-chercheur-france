import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';

/* ------------------------------- About block ----------------------------- */

/**
 * "À propos" block.
 *
 * Product decision: the company description now lives exclusively in the
 * header (always present in the DOM for SEO). To avoid two near-identical
 * descriptions of the same company, this block must ONLY render when it can
 * surface genuinely different, *structured* information (produits / services,
 * tags métiers, sous-secteurs, profils visiteurs, …).
 *
 * These structured fields are not yet exposed by the
 * `public_exhibitor_profiles` view, so — per the agreed step — the block is
 * hidden entirely. A free-text AI summary is intentionally NOT shown here, as
 * it reads as a duplicate of the header description for the user.
 *
 * SEO safety: hiding this block never removes content from the page — the main
 * `profile.description` stays in the header DOM (visually clamped, fully
 * present in the markup).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ExhibitorAbout({ profile }: { profile: PublicExhibitorProfile }) {
  // No structured data available yet → render nothing to remove the
  // header/about description redundancy.
  return null;
}