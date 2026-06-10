/**
 * Claim-campaign attribution helpers (claim-first model).
 *
 * Goal: carry an outreach campaign id (`camp`) from a prospecting deep-link
 * (`/exposants/:slug?camp={uuid}`) through the mandatory authentication step,
 * so the claim can be attributed to the campaign that triggered it.
 *
 * Two complementary channels keep the value alive across auth:
 *  - URL query string (survives email-confirmation redirectTo, even cross-tab)
 *  - sessionStorage (survives same-tab login)
 *
 * Hard rule: a missing / malformed / unknown camp must NEVER break the claim.
 * Every helper degrades silently to null.
 */

const STORAGE_KEY = 'lotexpo:claim_camp';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

interface StoredClaimCamp {
  camp: string;
  slug: string;
  ts: number;
}

/** Read the `camp` query param from a URLSearchParams (validated). */
export function readCampFromParams(params: URLSearchParams): string | null {
  const raw = params.get('camp');
  return isUuid(raw) ? (raw as string).trim() : null;
}

/** Read the `camp` query param from the live window URL (validated). */
function readCampFromWindow(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('camp');
    return isUuid(raw) ? (raw as string).trim() : null;
  } catch {
    return null;
  }
}

/**
 * Persist a valid camp for the given exhibitor slug. No-op when camp is
 * invalid (nothing stored), so a bad value can never pollute storage.
 */
export function persistClaimCampaign(camp: string | null, slug: string | null): void {
  if (!isUuid(camp) || !slug) return;
  try {
    const payload: StoredClaimCamp = { camp: camp.trim(), slug, ts: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable — degrade silently */
  }
}

/** Read the stored camp, only if it belongs to the current slug. */
function readStoredClaimCampaign(slug: string | null): string | null {
  if (!slug) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredClaimCamp>;
    if (isUuid(parsed?.camp) && parsed?.slug === slug) {
      return (parsed!.camp as string).trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the camp to attach to a claim submission for `slug`.
 * URL takes priority; falls back to sessionStorage (slug-matched).
 */
export function resolveClaimCampaign(slug: string | null): string | null {
  return readCampFromWindow() ?? readStoredClaimCampaign(slug);
}

/** Remove any stored camp (call after a successful claim). */
export function clearClaimCampaign(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
