// Rattachement d'un assistant créé en session anonyme au compte, après connexion.
const CLAIM_KEY = 'pending_assistant_claim';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingClaim {
  profile_id: string;
  claim_token: string;
  at: number;
}

export function savePendingClaim(profileId: string, claimToken: string): void {
  try {
    localStorage.setItem(
      CLAIM_KEY,
      JSON.stringify({ profile_id: profileId, claim_token: claimToken, at: Date.now() }),
    );
  } catch {
    /* stockage indisponible */
  }
}

export function clearPendingClaim(): void {
  try {
    localStorage.removeItem(CLAIM_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export function readPendingClaim(): PendingClaim | null {
  try {
    const raw = localStorage.getItem(CLAIM_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (
      !v ||
      typeof v.profile_id !== 'string' ||
      typeof v.claim_token !== 'string' ||
      typeof v.at !== 'number' ||
      Date.now() - v.at > MAX_AGE_MS
    ) {
      clearPendingClaim();
      return null;
    }
    return v as PendingClaim;
  } catch {
    clearPendingClaim();
    return null;
  }
}

export function claimParam(profileId: string, claimToken: string): string {
  return `${profileId}.${claimToken}`;
}
