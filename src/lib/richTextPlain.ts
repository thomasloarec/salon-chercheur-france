/**
 * Conversion HTML <-> texte brut pour les champs éditoriaux visibles par les
 * utilisateurs (organisateurs). L'utilisateur ne doit JAMAIS voir de balises :
 * on affiche du texte avec de vrais retours à la ligne, et on reconvertit en
 * HTML simple (<p> / <br/>) au moment de la publication pour conserver le
 * formatage sur la page publique.
 */

const FORMATTING_TAGS = 'p|br|div|ul|ol|li|h[1-6]|strong|b|em|i|u|s|blockquote|a';

/**
 * Répare les anciennes descriptions où les balises de mise en forme ont été
 * enregistrées comme du texte (`&lt;/p&gt;&lt;p&gt;`). Seules les balises
 * éditoriales connues sont décodées ; le nettoyage de sécurité reste effectué
 * au moment du rendu public.
 */
function decodeEscapedFormattingTags(value: string): string {
  const tagPattern = new RegExp(`&lt;\\s*(/?)\\s*(${FORMATTING_TAGS})([^&]*?)&gt;`, 'gi');
  return value.replace(tagPattern, (_match, closing: string, tag: string, attributes: string) => {
    const decodedAttributes = attributes
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&#x27;/gi, "'")
      .replace(/&amp;/gi, '&');
    return `<${closing}${tag}${decodedAttributes}>`;
  });
}

/** HTML simple -> texte brut avec retours à la ligne. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  const normalizedHtml = decodeEscapedFormattingTags(html);
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(normalizedHtml);
  if (!looksLikeHtml) return normalizedHtml;

  return normalizedHtml
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Texte brut -> HTML simple (<p> par paragraphe, <br/> par retour ligne). */
export function plainTextToHtml(text: string | null | undefined): string {
  if (!text) return '';
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';
  return normalized
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/**
 * Retourne un HTML éditorial cohérent quelle que soit la source : HTML Quill,
 * ancien HTML échappé ou texte brut avec retours à la ligne.
 */
export function normalizeRichTextHtml(value: string | null | undefined): string {
  if (!value) return '';
  const normalized = decodeEscapedFormattingTags(value).trim();
  if (!normalized) return '';
  return /<\/?[a-z][\s\S]*>/i.test(normalized)
    ? normalized
    : plainTextToHtml(normalized);
}
