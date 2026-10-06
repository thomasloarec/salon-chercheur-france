import { supabase } from '@/integrations/supabase/client';

// Les RPC booth_* ne sont pas dans les types générés : appel non typé.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown> = {}) => (supabase as any).rpc(fn, args);

export type BoothAccessStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'revoked';
export type BoothPlan = 'free' | 'beta' | 'pass' | 'annual' | null;

export interface BoothAccess {
  status: BoothAccessStatus;
  plan: BoothPlan;
  plan_event_id: string | null;
  plan_valid_until: string | null;
  is_paid: boolean;
  target_event_id: string | null;
  team_size: number | null;
  requested_at: string | null;
  reviewed_at: string | null;
}

export type BoothPhase = 'before' | 'during' | 'after' | 'unknown';

export interface BoothWorkspace {
  workspace_id: string;
  event_id: string;
  nom_event: string;
  event_slug: string | null;
  ville: string | null;
  date_debut: string | null;
  date_fin: string | null;
  stand_label: string | null;
  timezone: string | null;
  currency: string | null;
  total_cost: number | null;
  archived: boolean;
  phase: BoothPhase;
  full_features: boolean;
  interactions_count: number;
}

export interface BoothWorkspaceList {
  role: 'manager' | 'field';
  items: BoothWorkspace[];
}

export interface BoothCreateResult {
  workspace_id: string;
  created: boolean;
  participation_known: boolean;
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const getAccess = (exhibitorId: string) =>
  call<BoothAccess>('booth_get_access', { p_exhibitor_id: exhibitorId });

export const requestAccess = (
  exhibitorId: string,
  targetEventId: string | null,
  teamSize: number | null,
  message: string | null,
) =>
  call<unknown>('booth_request_access', {
    p_exhibitor_id: exhibitorId,
    p_target_event_id: targetEventId,
    p_team_size: teamSize,
    p_message: message,
  });

export const listWorkspaces = (exhibitorId: string) =>
  call<BoothWorkspaceList>('booth_list_workspaces', { p_exhibitor_id: exhibitorId });

export const createWorkspace = (exhibitorId: string, eventId: string, standLabel: string | null) =>
  call<BoothCreateResult>('booth_create_workspace', {
    p_exhibitor_id: exhibitorId,
    p_event_id: eventId,
    p_stand_label: standLabel,
  });

export const updateWorkspace = (
  workspaceId: string,
  opts: { standLabel?: string; totalCost?: number; clearCost?: boolean; archived?: boolean },
) => {
  const args: Record<string, unknown> = { p_workspace_id: workspaceId };
  if (opts.standLabel !== undefined) args.p_stand_label = opts.standLabel;
  if (opts.totalCost !== undefined) args.p_total_cost = opts.totalCost;
  if (opts.clearCost !== undefined) args.p_clear_cost = opts.clearCost;
  if (opts.archived !== undefined) args.p_archived = opts.archived;
  return call<unknown>('booth_update_workspace', args);
};

export function boothErrorMessage(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? error ?? '');
  if (msg.includes('BOOTH_FORBIDDEN')) return 'Seuls les gestionnaires principaux de la fiche peuvent faire cette action.';
  if (msg.includes('BOOTH_INVALID_INPUT')) return "Une information saisie n'est pas valide.";
  if (msg.includes('BOOTH_NOT_FOUND')) return 'Élément introuvable.';
  if (msg.includes('BOOTH_AUTH_REQUIRED')) return 'Connectez-vous pour continuer.';
  if (msg.includes('BOOTH_DISABLED')) return 'Lotexpo Leads est momentanément indisponible.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}
