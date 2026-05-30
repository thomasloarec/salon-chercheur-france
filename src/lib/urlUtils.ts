/**
 * Centralized URL normalization helpers for public exhibitor pages.
 *
 * Display/SEO only — these helpers NEVER mutate the database. They sanitize
 * values coming from `public_exhibitor_profiles` before they are used in:
 *  - the "Site officiel" / LinkedIn CTAs,
 *  - the JSON-LD Organization markup,
 *  - analytics `target_url` metadata.
 *
 * All functions return `string | null` (never `undefined`).
 */

// Canonical production origin used to resolve first-party relative assets.
const PRODUCTION_ORIGIN = 'https://lotexpo.com';

function trimOrNull(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalizes an external company website URL.
 *
 * Strategy:
 *  - empty / nullish / whitespace-only            -> null
 *  - contains internal whitespace                 -> null (not a clean URL)
 *  - starts with https://                         -> kept as-is (validated)
 *  - starts with http://                          -> kept as-is (preserved;
 *      we don't force https to avoid breaking sites that only serve http)
 *  - relative path ("/x", "//x")                  -> null
 *  - bare domain ("horn.fr", "www.horn.fr")       -> prefixed with https://
 *  - anything that isn't a parseable absolute URL -> null
 */
export function normalizeExternalUrl(input: string | null | undefined): string | null {
  const raw = trimOrNull(input);
  if (!raw) return null;

  // Reject values with internal whitespace or obvious free text.
  if (/\s/.test(raw)) return null;

  // Reject relative URLs ("/path" or protocol-relative "//host").
  if (raw.startsWith('/')) return null;

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    // No protocol: only accept if it looks like a real domain (label.tld).
    const domainLike = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+(\/.*)?$/i;
    if (!domainLike.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Normalizes an image URL (e.g. a logo) for use in JSON-LD `logo`.
 *
 * Strategy:
 *  - empty / nullish                              -> null
 *  - absolute http(s):// URL                      -> kept as-is (validated)
 *  - first-party site-relative path ("/logos/..") -> resolved against the
 *      production origin (domain is certain: it's our own asset)
 *  - bare domain / free text / other relative     -> null
 *    (we never guess https:// for an uncertain image domain)
 */
export function normalizeImageUrl(input: string | null | undefined): string | null {
  const raw = trimOrNull(input);
  if (!raw) return null;
  if (/\s/.test(raw)) return null;

  // First-party absolute path → resolve against the canonical origin.
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    try {
      return new URL(raw, PRODUCTION_ORIGIN).toString();
    } catch {
      return null;
    }
  }

  // Must already be an absolute http(s) URL.
  if (!/^https?:\/\//i.test(raw)) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Validates and normalizes a LinkedIn company/showcase URL (Phase 2C rules,
 * mirrored client-side).
 *
 * Accepts only:
 *  - https://[*.]linkedin.com/company/...
 *  - https://[*.]linkedin.com/showcase/...
 * Rejects /in/..., /posts/..., /jobs/..., non-LinkedIn hosts and free text.
 * A missing protocol is upgraded to https:// before validation.
 */
export function normalizeLinkedInUrl(input: string | null | undefined): string | null {
  const raw = trimOrNull(input);
  if (!raw) return null;
  if (/\s/.test(raw)) return null;

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  const isLinkedInHost = host === 'linkedin.com' || host.endsWith('.linkedin.com');
  if (!isLinkedInHost) return null;

  // Only company / showcase pages are valid organization identities.
  if (!/^\/(company|showcase)\/[^/]+/i.test(url.pathname)) return null;

  // Force https for the canonical output.
  url.protocol = 'https:';
  return url.toString();
}
