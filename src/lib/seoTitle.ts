/**
 * Construction des <title> SEO : le socle (nom, phrase) est tronqué AVANT
 * d'ajouter le suffixe de marque, jamais après. Tronquer après produit des
 * finissions tronquées en production (« … – Lotexp », « … | Lot »).
 *
 * Miroir strict de seoTitle()/cutWords() dans scripts/prerender-seo.mjs :
 * la version statique et la version react-helmet doivent rester identiques.
 */

/** Coupe sur un mot entier (jamais au milieu d'un mot), sans ellipse. */
export function cutWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s,;:–—-]+$/, '');
}

/**
 * Assemble `prefix (optionnel) + base + brandSuffix` en garantissant :
 * - le suffixe de marque est toujours complet (jamais « | Lot », « – Lotexp ») ;
 * - la troncature du socle se fait sur un mot entier ;
 * - le total ne dépasse jamais `max` caractères (sauf suffixe seul > max).
 */
export function buildSeoTitle(
  base: string,
  brandSuffix: string,
  max: number,
  prefix?: string,
): string {
  const cleanBase = String(base || '').replace(/\s+/g, ' ').trim();
  const head = prefix ? `${prefix} ` : '';
  const full = `${head}${cleanBase} ${brandSuffix}`;
  if (full.length <= max) return full;
  const budget = Math.max(0, max - head.length - brandSuffix.length - 1);
  if (budget < 3) return full.slice(0, max);
  return `${head}${cutWords(cleanBase, budget)} ${brandSuffix}`;
}
