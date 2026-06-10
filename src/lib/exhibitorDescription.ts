/**
 * Détection des résumés IA "refus" (ex. « Données insuffisantes pour analyse. »)
 * que d'anciennes passes d'enrichissement ont stockés dans exhibitor_ai.resume_court.
 *
 * Source de vérité côté SQL : fonction public.is_ai_refusal(text).
 * Ce module reproduit la même logique côté client pour filtrer tout résidu
 * à l'affichage (filet de sécurité), et fournir le libellé de remplacement.
 */

/** Libellé affiché quand aucune description exploitable n'est disponible. */
export const NO_DESCRIPTION_LABEL = "Aucune description pour cette entreprise.";

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const REFUSAL_PATTERNS: RegExp[] = [
  /donnees? insuffisantes/,
  /informations? insuffisantes/,
  /impossib[^.]{0,40}(analys|qualifi)/,
  /aucune description ni contenu web/,
  /aucun contenu de site web[^.]{0,40}fourni/,
  /veuillez fournir[^.]{0,40}(description|site web)/,
];

/** Renvoie true si le texte est un message de refus généré par l'IA. */
export function isAiRefusal(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = stripAccents(text).toLowerCase().trim();
  if (!normalized) return false;
  return REFUSAL_PATTERNS.some((re) => re.test(normalized));
}

/**
 * Nettoie une description : renvoie null si vide ou si c'est un refus IA.
 * Sinon renvoie le texte tel quel.
 */
export function cleanAiDescription(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed || isAiRefusal(trimmed)) return null;
  return trimmed;
}
