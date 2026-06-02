import type { PublicExhibitorProfile } from '@/hooks/useExhibitorProfile';

/* ------------------------------- About block ----------------------------- */

/** Loose normalization used only to detect visual redundancy between the
 *  header description and the "À propos" content. */
function normalize(text: string | null | undefined): string {
  return (text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "À propos" block. To avoid duplicating the short description already shown
 * in the header, this section is only rendered when it brings *additional*
 * content — i.e. an AI summary that is meaningfully different from the header
 * description. SEO safety: the header keeps `profile.description` in the DOM,
 * so hiding this block never removes the main descriptive text from the page.
 */
export default function ExhibitorAbout({ profile }: { profile: PublicExhibitorProfile }) {
  const headerText = normalize(profile.description);
  const aiSummary = profile.ai_summary?.trim() || '';
  const aiNormalized = normalize(aiSummary);

  // Content worth showing: an AI summary that differs from the header text and
  // is not merely a substring of it (and vice-versa).
  const aboutText =
    aiSummary &&
    aiNormalized !== headerText &&
    !(headerText && aiNormalized.includes(headerText)) &&
    !(headerText && headerText.includes(aiNormalized))
      ? aiSummary
      : '';

  // Nothing additional to show → render nothing (header already carries the
  // description). This removes the previous header/about redundancy.
  if (!aboutText) return null;

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">À propos</h2>
      <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
        {aboutText}
      </p>
    </section>
  );
}