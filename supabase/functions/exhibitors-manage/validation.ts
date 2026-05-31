// ════════════════════════════════════════════════════════════════════
// Phase 4A-B — Validation serveur des champs publics éditables.
// Réplique stricte de src/lib/urlUtils.ts côté Deno. Display/SEO only :
// ces helpers ne devinent rien d'incertain et renvoient null si invalide.
// Extraits dans un module dédié pour être unit-testables sans démarrer
// le serveur (index.ts appelle Deno.serve au top-level).
// ════════════════════════════════════════════════════════════════════

export const DESCRIPTION_MAX_LEN = 3000

function trimOrNull(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * description : texte brut uniquement.
 *  - trim ;
 *  - balises HTML supprimées (texte brut) ;
 *  - chaîne vide → null ;
 *  - longueur max 3000 → erreur si dépassée (validation légitime,
 *    ne révèle aucune structure interne).
 */
export function sanitizeDescription(
  input: unknown,
): { value: string | null; error?: string } {
  if (input === null || input === undefined) return { value: null }
  if (typeof input !== 'string') {
    return { value: null, error: 'description must be a string' }
  }
  const stripped = input.replace(/<[^>]*>/g, '')
  const trimmed = stripped.trim()
  if (trimmed.length === 0) return { value: null }
  if (trimmed.length > DESCRIPTION_MAX_LEN) {
    return { value: null, error: `description must be ${DESCRIPTION_MAX_LEN} characters or less` }
  }
  return { value: trimmed }
}

/**
 * website — mirror de normalizeExternalUrl (urlUtils.ts).
 *  - vide/whitespace → null ;
 *  - espaces internes → null ;
 *  - chemin relatif ("/x", "//x") → null ;
 *  - https://… / http://… conservés ;
 *  - domaine nu ("horn.fr") → préfixé https:// ;
 *  - email / texte libre → null.
 */
export function normalizeExternalUrl(input: unknown): string | null {
  const raw = trimOrNull(input)
  if (!raw) return null
  if (/\s/.test(raw)) return null
  if (raw.startsWith('/')) return null
  if (/^mailto:/i.test(raw) || raw.includes('@')) return null

  let candidate = raw
  if (!/^https?:\/\//i.test(candidate)) {
    const domainLike = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+(\/.*)?$/i
    if (!domainLike.test(candidate)) return null
    candidate = `https://${candidate}`
  }

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * linkedin_url — mirror de normalizeLinkedInUrl (urlUtils.ts).
 * Accepte uniquement [*.]linkedin.com/company/… ou /showcase/…
 * Refuse /in/…, /posts/…, /jobs/…, faux domaines, texte libre.
 */
export function normalizeLinkedInUrl(input: unknown): string | null {
  const raw = trimOrNull(input)
  if (!raw) return null
  if (/\s/.test(raw)) return null

  let candidate = raw
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.toLowerCase()
  const isLinkedInHost = host === 'linkedin.com' || host.endsWith('.linkedin.com')
  if (!isLinkedInHost) return null

  if (!/^\/(company|showcase)\/[^/]+/i.test(url.pathname)) return null

  url.protocol = 'https:'
  return url.toString()
}

/**
 * normalizeImageUrl — mirror de urlUtils.ts (sans résolution first-party).
 * Doit être une URL absolue http(s) valide.
 */
export function normalizeImageUrl(input: unknown): string | null {
  const raw = trimOrNull(input)
  if (!raw) return null
  if (/\s/.test(raw)) return null
  if (!/^https?:\/\//i.test(raw)) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * logo_url (Phase 4A-B, option recommandée).
 * N'accepte qu'une URL image valide ISSUE du bucket public exhibitor-logos.
 *  - URL invalide → null ;
 *  - SVG → null ;
 *  - hors préfixe bucket → null ;
 *  - chaîne vide → null (permet de retirer le logo).
 */
export function validateLogoUrl(input: unknown, supabaseUrl: string): string | null {
  const normalized = normalizeImageUrl(input)
  if (!normalized) return null
  if (/\.svg(\?|#|$)/i.test(normalized)) return null
  if (!supabaseUrl) return null
  const prefix = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/exhibitor-logos/`
  if (!normalized.startsWith(prefix)) return null
  return normalized
}

/**
 * Whitelist des champs publics éditables en Phase 4A-B.
 * Toute clé hors de cette liste est ignorée silencieusement.
 */
export const PUBLIC_EDITABLE_FIELDS = ['description', 'website', 'linkedin_url', 'logo_url'] as const