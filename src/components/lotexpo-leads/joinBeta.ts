export interface JoinBetaInput {
  loggedIn: boolean;
  hasLeadsAccess: boolean;
  exhibitorSlugs: string[];
}

export type JoinBetaResult =
  | { kind: 'auth'; to: string }
  | { kind: 'open'; to: string }
  | { kind: 'manage'; to: string }
  | { kind: 'choose' }
  | { kind: 'claim' };

export const AUTH_RETURN = '/auth?redirect=/lotexpo-leads%23beta';
export const manageLink = (slug: string) => `/exposants/${slug}/gerer?section=leads`;

/** Destination unique des boutons « Rejoindre la bêta ». */
export function joinBeta({ loggedIn, hasLeadsAccess, exhibitorSlugs }: JoinBetaInput): JoinBetaResult {
  if (!loggedIn) return { kind: 'auth', to: AUTH_RETURN };
  if (hasLeadsAccess) return { kind: 'open', to: '/leads' };
  if (exhibitorSlugs.length === 1) return { kind: 'manage', to: manageLink(exhibitorSlugs[0]) };
  if (exhibitorSlugs.length > 1) return { kind: 'choose' };
  return { kind: 'claim' };
}
