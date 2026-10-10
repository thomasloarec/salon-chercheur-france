import { supabase } from '@/integrations/supabase/client';
import type { Contact, Interaction, Opportunity } from './types';

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

/** Objectif du jour (manager). null efface l'objectif. */
export const setDailyGoal = (workspaceId: string, goal: number | null) =>
  call<unknown>('booth_set_daily_goal', { p_workspace_id: workspaceId, p_goal: goal });

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

export type BoothMemberRole = 'manager' | 'field';

export interface BoothMember {
  member_id: string | null;
  user_id: string | null;
  role: BoothMemberRole;
  status: 'active' | 'invited';
  inherited: boolean;
  display_name: string;
  email: string | null;
  invite_expires_at: string | null;
}

export interface BoothMemberList {
  role: BoothMemberRole;
  items: BoothMember[];
}

export interface BoothInviteResult {
  member_id: string;
  email: string;
  role: BoothMemberRole;
  expires_at: string;
  invite_url: string;
  email_sent: boolean;
}

export const listMembers = (exhibitorId: string) =>
  call<BoothMemberList>('booth_list_members', { p_exhibitor_id: exhibitorId });

export const revokeMember = (memberId: string) =>
  call<unknown>('booth_revoke_member', { p_member_id: memberId });

export async function inviteMember(
  exhibitorId: string,
  email: string,
  role: BoothMemberRole,
): Promise<BoothInviteResult> {
  const { data, error } = await supabase.functions.invoke('booth-invite', {
    body: { exhibitor_id: exhibitorId, email, role },
  });
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.error || 'BOOTH_ERROR');
  }
  return data as BoothInviteResult;
}

/* ---------- Paiement en ligne ---------- */

export type BoothCheckoutPlan = 'pass' | 'annual';

export interface BoothBillingPayment {
  id: string;
  plan: BoothCheckoutPlan;
  status: 'paid' | 'refunded';
  event_id: string | null;
  event_name: string | null;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  valid_until: string | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: string;
}

export interface BoothBillingOverview {
  livemode: boolean;
  vat_mode: 'franchise' | 'vat';
  currency: string;
  pass_amount_cents: number;
  annual_amount_cents: number;
  pass_grace_days: number;
  payments: BoothBillingPayment[];
}

export async function getBillingOverview(exhibitorId: string): Promise<BoothBillingOverview> {
  const { data, error } = await rpc('booth_billing_overview', { p_exhibitor_id: exhibitorId });
  if (error) throw new Error(error.message || 'BOOTH_ERROR');
  return data as BoothBillingOverview;
}

export async function startCheckout(
  exhibitorId: string,
  plan: BoothCheckoutPlan,
  eventId: string | null,
): Promise<{ url: string; payment_id: string }> {
  const { data, error } = await supabase.functions.invoke('booth-checkout', {
    body: { exhibitor_id: exhibitorId, plan, event_id: eventId },
  });
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.error || 'BOOTH_ERROR');
  }
  return data as { url: string; payment_id: string };
}

export function boothErrorMessage(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? error ?? '');
  if (msg.includes('BOOTH_VOICE_QUOTA')) return 'Vous avez utilisé les 300 notes vocales offertes ce mois-ci.';
  if (msg.includes('BOOTH_AUDIO_TOO_LONG')) return 'La note dépasse 90 secondes.';
  if (msg.includes('BOOTH_AUDIO_TOO_LARGE')) return 'Note trop volumineuse, réessayez plus court.';
  if (msg.includes('BOOTH_VOICE_FAILED')) return 'La transcription a échoué. Réessayez ou saisissez à la main.';
  if (msg.includes('BOOTH_SUMMARY_FAILED')) return "La synthèse n'a pas pu être rédigée. Réessayez dans un instant.";
  if (msg.includes('BOOTH_RATE_LIMITED')) return 'Trop de demandes en peu de temps. Réessayez plus tard.';
  if (msg.includes('BOOTH_SCAN_FAILED')) return "La lecture n'a pas abouti. Reprenez la photo ou saisissez le contact à la main.";
  if (msg.includes('BOOTH_IMAGE_TOO_LARGE')) return 'Photo trop lourde. Reprenez-la.';
  if (msg.includes('BOOTH_IMAGE_UNREADABLE')) return 'Format de photo non lu. Reprenez la photo.';
  if (msg.includes('BOOTH_WORKSPACE_ARCHIVED')) return 'Ce salon est archivé : plus de nouvelle saisie possible.';
  if (msg.includes('BOOTH_ALREADY_MERGED')) return 'Ce contact a déjà été fusionné.';
  if (msg.includes('BOOTH_INVITE_EXPIRED')) return "Ce lien d'invitation a expiré. Demandez une nouvelle invitation.";
  if (msg.includes('BOOTH_INVITE_INVALID')) return "Ce lien d'invitation n'est pas valide ou a déjà été utilisé.";
  if (msg.includes('BOOTH_EMAIL_MISMATCH')) return 'Cette invitation a été envoyée à une autre adresse email.';
  if (msg.includes('BOOTH_PLAN_REQUIRED')) return "L'invitation d'équipe est incluse dans la bêta, le Pass Salon et l'Annuel.";
  if (msg.includes('BOOTH_SEATS_FULL')) return 'Limite atteinte : 15 comptes au total, administrateurs de la fiche et invitations en cours compris.';
  if (msg.includes('BOOTH_EVENT_PAST')) return 'Ce salon est terminé : choisissez un salon à venir.';
  if (msg.includes('BOOTH_ALREADY_COVERED')) return 'Votre Annuel en cours couvre déjà ce salon.';
  if (msg.includes('BOOTH_PAYMENT_UNAVAILABLE')) return 'Le paiement en ligne est momentanément indisponible. Réessayez dans un instant ou écrivez-nous.';
  if (msg.includes('BOOTH_ALREADY_MEMBER')) return 'Cette personne fait déjà partie de l\u2019équipe.';
  if (msg.includes('BOOTH_ACCESS_NOT_APPROVED')) return "L'accès doit d'abord être ouvert.";
  if (msg.includes('BOOTH_FORBIDDEN')) return 'Seuls les gestionnaires principaux de la fiche peuvent faire cette action.';
  if (msg.includes('BOOTH_INVALID_INPUT')) return "Une information saisie n'est pas valide.";
  if (msg.includes('BOOTH_NOT_FOUND')) return 'Élément introuvable.';
  if (msg.includes('BOOTH_AUTH_REQUIRED')) return 'Connectez-vous pour continuer.';
  if (msg.includes('BOOTH_DISABLED')) return 'Lotexpo Leads est momentanément indisponible.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

/* ---------- Admin ---------- */

export interface BoothAdminAccessItem {
  id: string;
  exhibitor_id: string;
  exhibitor_name: string | null;
  exhibitor_slug: string | null;
  status: BoothAccessStatus;
  plan: BoothPlan;
  plan_event_id: string | null;
  plan_event_name: string | null;
  plan_valid_until: string | null;
  requested_by: string | null;
  requested_by_email: string | null;
  target_event_id: string | null;
  target_event_name: string | null;
  target_event_start: string | null;
  team_size: number | null;
  message: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface BoothAdminAccessList {
  total: number;
  items: BoothAdminAccessItem[];
}

export const adminListAccess = (status: BoothAccessStatus | null) =>
  call<BoothAdminAccessList>('booth_admin_list_access', { p_status: status });

export type BoothAdminDecision = 'approve' | 'reject' | 'revoke' | 'set_plan';

export const adminReviewAccess = (opts: {
  exhibitorId: string;
  decision: BoothAdminDecision;
  note?: string | null;
  plan?: Exclude<BoothPlan, null>;
  planEventId?: string | null;
  planValidUntil?: string | null;
}) =>
  call<unknown>('booth_admin_review_access', {
    p_exhibitor_id: opts.exhibitorId,
    p_decision: opts.decision,
    p_note: opts.note ?? null,
    p_plan: opts.plan ?? 'beta',
    p_plan_event_id: opts.planEventId ?? null,
    p_plan_valid_until: opts.planValidUntil ?? null,
  });

/* ---------- Membres d'équipe ---------- */

export interface BoothAcceptResult {
  exhibitor_id: string;
  exhibitor_name: string;
  role: BoothMemberRole;
}

export interface BoothContextItem {
  exhibitor_id: string;
  exhibitor_name: string;
  exhibitor_slug: string | null;
  logo_url: string | null;
  role: BoothMemberRole | null;
  access_status: BoothAccessStatus;
  plan: BoothPlan;
  plan_valid_until: string | null;
  is_paid: boolean;
  is_fiche_manager: boolean;
}

export const acceptInvite = (token: string) =>
  call<BoothAcceptResult>('booth_accept_invite', { p_token: token });

export const myContext = () => call<{ items: BoothContextItem[] }>('booth_my_context', {});

/* ---------- Mode salon ---------- */


export type BoothSyncKind = 'contact' | 'interaction' | 'opportunity';

export interface BoothBootstrapWorkspace {
  workspace_id: string;
  exhibitor_id: string;
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
  /** Objectif de rencontres par jour pour l'équipe, null si aucun. */
  daily_goal?: number | null;
}

export interface BoothTeammate {
  user_id: string;
  role: BoothMemberRole;
  name: string | null;
  email: string | null;
}

export interface BoothInboundLead {
  lead_id: string;
  type: string;
  created_at: string;
  name: string | null;
  email: string | null;
  company: string | null;
  job_title: string | null;
  phone: string | null;
  rdv_date: string | null;
  preferred_slot: string | null;
  status: string | null;
}

export interface BoothBootstrap {
  server_time: string;
  next_since: string | null;
  role: BoothMemberRole;
  me: string;
  full_features: boolean;
  workspace: BoothBootstrapWorkspace;
  team: BoothTeammate[];
  contacts: { total: number; truncated: boolean; items: Contact[] };
  interactions: Interaction[];
  opportunities: Opportunity[];
  inbound_leads: BoothInboundLead[];
}

export interface BoothSyncItem {
  kind: BoothSyncKind;
  id: string;
  data: Record<string, unknown>;
  client_updated_at: string;
}

export interface BoothSyncResult {
  index: number;
  kind: BoothSyncKind;
  id: string;
  status: 'created' | 'updated' | 'unchanged' | 'stale' | 'merged' | 'error';
  error?: string;
  row?: Record<string, unknown>;
  merged_into_id?: string;
  contact_id?: string;
}

export interface BoothSyncResponse {
  server_time: string;
  results: BoothSyncResult[];
  counts: Record<string, number>;
}

export const bootstrap = (workspaceId: string, since: string | null) =>
  call<BoothBootstrap>('booth_bootstrap', { p_workspace_id: workspaceId, p_since: since });

export const sync = (exhibitorId: string, items: BoothSyncItem[]) =>
  call<BoothSyncResponse>('booth_sync', { p_exhibitor_id: exhibitorId, p_items: items });

export interface BoothContactSearchItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  lotexpo_company_ref: string | null;
  interactions_count: number;
  last_interaction_at: string | null;
}

export const searchContacts = (exhibitorId: string, query: string, limit = 20) =>
  call<{ total: number; items: BoothContactSearchItem[] }>('booth_search_contacts', {
    p_exhibitor_id: exhibitorId,
    p_query: query,
    p_limit: limit,
  });

export interface BoothCompanySearchItem {
  public_identity_id: string;
  exhibitor_id: string | null;
  name: string;
  website: string | null;
  domain: string | null;
  logo_url: string | null;
  public_slug: string | null;
}

export const searchCompanies = (query: string, limit = 10) =>
  call<{ total: number; items: BoothCompanySearchItem[] }>('booth_search_companies', {
    p_query: query,
    p_limit: limit,
  });

/* ---------- Doublons ---------- */

export interface BoothDuplicateContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  created_by: string | null;
  interactions_count: number;
}

export interface BoothDuplicateGroup {
  match: 'email' | 'phone';
  value: string;
  contacts: BoothDuplicateContact[];
}

export const findDuplicates = (exhibitorId: string) =>
  call<{ total: number; items: BoothDuplicateGroup[] }>('booth_find_duplicates', { p_exhibitor_id: exhibitorId });

export const mergeContacts = (keepId: string, mergeId: string) =>
  call<{
    keep_id: string;
    merged_id: string;
    interactions_moved: number;
    opportunities_moved: number;
    previous_merges_moved: number;
  }>('booth_merge_contacts', { p_keep_id: keepId, p_merge_id: mergeId });

/* ---------- Lecture de carte ---------- */

export interface BoothCardFields {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  linkedin_url: string | null;
}

export interface BoothCardScanResult {
  scan_id: string;
  status: 'ok' | 'unreadable';
  fields?: BoothCardFields;
  confidence?: Partial<Record<keyof BoothCardFields, 'high' | 'medium' | 'low'>>;
  company_domain?: string | null;
  qr_present?: boolean;
}

export async function scanCard(opts: {
  workspaceId: string;
  scanId: string;
  kind: 'card' | 'badge';
  imageBase64: string;
  mediaType: string;
}): Promise<BoothCardScanResult> {
  let res;
  try {
    res = await supabase.functions.invoke('booth-card-scan', {
      body: {
        workspace_id: opts.workspaceId,
        scan_id: opts.scanId,
        kind: opts.kind,
        image_base64: opts.imageBase64,
        media_type: opts.mediaType,
      },
    });
  } catch {
    throw new Error('BOOTH_NETWORK');
  }
  const { data, error } = res;
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context;
    if (!ctx || typeof ctx.json !== 'function' || (error as { name?: string }).name === 'FunctionsFetchError') {
      throw new Error('BOOTH_NETWORK');
    }
    const body = await ctx.json().catch(() => null);
    throw new Error(body?.error || 'BOOTH_ERROR');
  }
  return data as BoothCardScanResult;
}

export const linkCardScan = (scanId: string, contactId: string) =>
  call<unknown>('booth_card_scan_link', { p_scan_id: scanId, p_contact_id: contactId });

/* ---------- Bilan et export ---------- */

export interface BoothWorkspaceSummaryItem {
  workspace_id: string;
  nom_event: string;
  ville: string | null;
  date_debut: string | null;
  date_fin: string | null;
  currency: string | null;
  total_cost: number | null;
  archived: boolean;
  phase: BoothPhase;
  meetings: number;
  people: number;
  new_prospects: number;
  hot: number;
  customers: number;
  actions_open: number;
  actions_done: number;
  actions_overdue: number;
  projects: number;
  projects_amount: number | null;
  projects_without_amount: number;
  weighted_amount: number | null;
  won: number;
  won_amount: number | null;
  lost: number;
}

export const workspacesSummary = (exhibitorId: string) =>
  call<{ items: BoothWorkspaceSummaryItem[] }>('booth_workspaces_summary', { p_exhibitor_id: exhibitorId });

export interface BoothExportRow {
  interaction_id: string;
  occurred_at: string;
  local_date: string | null;
  local_time: string | null;
  day_number: number | null;
  status: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  contact_source: string | null;
  relationship: string | null;
  customer_topic: string | null;
  potential: string | null;
  next_action: string | null;
  next_action_due: string | null;
  next_action_done_at: string | null;
  next_action_owner: string | null;
  owner: string | null;
  note: string | null;
  capture_source: string | null;
  project_title: string | null;
  project_value_band: string | null;
  project_amount: number | null;
  project_horizon: string | null;
  project_probability: number | null;
  project_status: string | null;
  project_won_amount: number | null;
}

export interface BoothExportProject {
  opportunity_id: string;
  created_at: string | null;
  title: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  value_band: string | null;
  amount: number | null;
  currency: string | null;
  horizon: string | null;
  probability: number | null;
  status: string | null;
  won_amount: number | null;
  won_at: string | null;
  lost_at: string | null;
  owner: string | null;
}

export interface BoothExport {
  workspace: { nom_event?: string; [k: string]: unknown };
  rows: BoothExportRow[];
  projects: BoothExportProject[];
  generated_at: string;
}

export const exportWorkspace = (workspaceId: string) =>
  call<BoothExport>('booth_export_workspace', { p_workspace_id: workspaceId });

/* ---------- Notes vocales et synthèse ---------- */

async function invokeBooth<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  let res;
  try {
    res = await supabase.functions.invoke(fn, { body });
  } catch {
    throw new Error('BOOTH_NETWORK');
  }
  const { data, error } = res;
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context;
    if (!ctx || typeof ctx.json !== 'function' || (error as { name?: string }).name === 'FunctionsFetchError') {
      throw new Error('BOOTH_NETWORK');
    }
    const parsed = await ctx.json().catch(() => null);
    throw new Error(parsed?.error || 'BOOTH_ERROR');
  }
  return data as T;
}

export interface BoothVoiceFields {
  contact: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    job_title: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  relationship: string | null;
  customer_topic: string | null;
  potential: string | null;
  project: { title: string | null; amount: number | null; value_band: string | null; horizon: string | null } | null;
  next_action: string | null;
  next_action_due: string | null;
  note: string | null;
}

export interface BoothVoiceNoteResult {
  note_id: string;
  status: 'ok' | 'empty';
  transcript: string | null;
  fields?: BoothVoiceFields;
  confidence?: Record<string, 'high' | 'medium' | 'low'>;
  remaining_month?: number;
}

export const voiceNote = (opts: {
  workspaceId: string;
  noteId: string;
  mode: 'capture' | 'note';
  audioBase64: string;
  mediaType: string;
  durationMs: number;
}) =>
  invokeBooth<BoothVoiceNoteResult>('booth-voice-note', {
    workspace_id: opts.workspaceId,
    note_id: opts.noteId,
    mode: opts.mode,
    audio_base64: opts.audioBase64,
    media_type: opts.mediaType,
    duration_ms: opts.durationMs,
  });

export interface BoothVoiceUsage {
  available: boolean;
  used_month: number;
  limit_month: number;
  remaining_month: number;
  max_seconds: number;
}

export const voiceUsage = (workspaceId: string) =>
  call<BoothVoiceUsage>('booth_voice_usage', { p_workspace_id: workspaceId });

export const linkVoiceNote = (noteId: string, interactionId: string) =>
  call<unknown>('booth_voice_link', { p_note_id: noteId, p_interaction_id: interactionId });

export interface BoothDebriefSummary {
  status: 'ok' | 'empty';
  total: number;
  truncated: boolean;
  summary?: {
    headline: string;
    overview: string;
    priorities: Array<{ company: string | null; person: string | null; reason: string | null; action: string | null }>;
    followups: Array<{ company: string | null; action: string | null; due: string | null; followed_by: string | null }>;
    signals: string[];
  };
}

export const debriefSummary = (opts: { workspaceId: string; day: string | null; scope: 'team' | 'mine' }) =>
  invokeBooth<BoothDebriefSummary>('booth-debrief-summary', {
    workspace_id: opts.workspaceId,
    day: opts.day,
    scope: opts.scope,
  });
