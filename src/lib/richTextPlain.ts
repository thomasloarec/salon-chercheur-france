/**
 * Conversion HTML <-> texte brut pour les champs éditoriaux visibles par les
 * utilisateurs (organisateurs). L'utilisateur ne doit JAMAIS voir de balises :
 * on affiche du texte avec de vrais retours à la ligne, et on reconvertit en
 * HTML simple (<p> / <br/>) au moment de la publication pour conserver le
 * formatage sur la page publique.
 */

/** HTML simple -> texte brut avec retours à la ligne. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  if (!looksLikeHtml) return html;

  return html
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
