/**
 * Détection des résumés IA "refus" (ex. « Données insuffisantes pour analyse. »).
 * Doit rester synchronisé avec public.is_ai_refusal(text) et src/lib/exhibitorDescription.ts.
 */

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const REFUSAL_PATTERNS: RegExp[] = [
  /donnees? insuffisantes/,
  /informations? insuffisantes/,
  /impossib[^.]{0,40}(analys|qualifi)/,
  /aucune description ni contenu web/,
  /aucun contenu de site web[^.]{0,40}fourni/,
  /veuillez fournir[^.]{0,40}(description|site web)/,
];

export function isAiRefusal(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = stripAccents(text).toLowerCase().trim();
  if (!normalized) return false;
  return REFUSAL_PATTERNS.some((re) => re.test(normalized));
}
