import { get, put, getAllByPrefix } from '../storage/db';
import type { BoothBootstrap, BoothSyncKind } from '@/lib/booth/rpc';
import type { Contact, Interaction, Opportunity } from '@/lib/booth/types';

export interface BoothCache {
  key: string;
  userId: string;
  workspaceId: string;
  exhibitorId: string;
  workspace: BoothBootstrap['workspace'];
  team: BoothBootstrap['team'];
  contacts: Contact[];
  contacts_total: number;
  contacts_truncated: boolean;
  interactions: Interaction[];
  opportunities: Opportunity[];
  inbound_leads: BoothBootstrap['inbound_leads'];
  role: BoothBootstrap['role'];
  me: string;
  full_features: boolean;
  next_since: string | null;
  saved_at: string;
}

export const cacheKey = (userId: string, workspaceId: string) => `${userId}|${workspaceId}`;

type Listener = () => void;
const listeners = new Set<Listener>();
export function onBoothChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const emitBoothChange = () => listeners.forEach((f) => f());

export const readCache = (userId: string, workspaceId: string) =>
  get<BoothCache>('cache', cacheKey(userId, workspaceId));

export async function writeCache(c: BoothCache) {
  await put('cache', c);
  emitBoothChange();
}

const listName = (kind: BoothSyncKind) =>
  kind === 'contact' ? 'contacts' : kind === 'interaction' ? 'interactions' : 'opportunities';

type AnyRow = { id: string } & Record<string, unknown>;

function isInactiveContact(r: AnyRow) {
  return !!r.archived_at || !!r.merged_into_id;
}

/** Fusionne des lignes serveur dans une liste locale, sans écraser les lignes en attente d'envoi. */
export function mergeRows<T extends AnyRow>(local: T[], incoming: T[], pendingIds: Set<string>, contacts = false): T[] {
  const map = new Map(local.map((r) => [r.id, r]));
  for (const row of incoming) {
    if (pendingIds.has(row.id)) continue;
    if (contacts && isInactiveContact(row)) {
      map.delete(row.id);
      continue;
    }
    map.set(row.id, { ...(map.get(row.id) ?? {}), ...row } as T);
  }
  return Array.from(map.values());
}

/** Fusionne une réponse d'amorçage dans le cache existant (ou en crée un). */
export function mergeBootstrap(
  userId: string,
  workspaceId: string,
  prev: BoothCache | undefined,
  b: BoothBootstrap,
  pendingIds: Set<string>,
): BoothCache {
  const base: BoothCache = prev ?? {
    key: cacheKey(userId, workspaceId),
    userId,
    workspaceId,
    exhibitorId: b.workspace.exhibitor_id,
    workspace: b.workspace,
    team: [],
    contacts: [],
    contacts_total: 0,
    contacts_truncated: false,
    interactions: [],
    opportunities: [],
    inbound_leads: [],
    role: b.role,
    me: b.me,
    full_features: b.full_features,
    next_since: null,
    saved_at: new Date().toISOString(),
  };
  const contacts = b.contacts?.items ?? [];
  return {
    ...base,
    exhibitorId: b.workspace.exhibitor_id,
    workspace: b.workspace,
    team: b.team ?? base.team,
    contacts: mergeRows(base.contacts as unknown as AnyRow[], contacts as unknown as AnyRow[], pendingIds, true) as unknown as Contact[],
    contacts_total: b.contacts?.total ?? base.contacts_total,
    contacts_truncated: b.contacts?.truncated ?? base.contacts_truncated,
    interactions: mergeRows(base.interactions as unknown as AnyRow[], (b.interactions ?? []) as unknown as AnyRow[], pendingIds) as unknown as Interaction[],
    opportunities: mergeRows(base.opportunities as unknown as AnyRow[], (b.opportunities ?? []) as unknown as AnyRow[], pendingIds) as unknown as Opportunity[],
    inbound_leads: mergeRows(base.inbound_leads.map((l) => ({ ...l, id: l.lead_id })) as AnyRow[], (b.inbound_leads ?? []).map((l) => ({ ...l, id: l.lead_id })) as AnyRow[], new Set()) as unknown as BoothCache['inbound_leads'],
    role: b.role,
    me: b.me,
    full_features: b.full_features,
    next_since: b.next_since ?? base.next_since,
    saved_at: new Date().toISOString(),
  };
}

async function cachesForExhibitor(userId: string, exhibitorId: string) {
  const all = await getAllByPrefix<BoothCache>('cache', `${userId}|`);
  return all.filter((c) => c.exhibitorId === exhibitorId);
}

/** Applique une modification locale (création ou mise à jour) dans les caches concernés. */
export async function applyLocalRow(
  userId: string,
  exhibitorId: string,
  kind: BoothSyncKind,
  id: string,
  data: Record<string, unknown>,
  replace = false,
) {
  const caches = await cachesForExhibitor(userId, exhibitorId);
  const name = listName(kind);
  for (const c of caches) {
    const list = c[name] as unknown as AnyRow[];
    const idx = list.findIndex((r) => r.id === id);
    const wsId = data.workspace_id as string | undefined;
    if (idx < 0 && kind !== 'contact' && wsId && wsId !== c.workspaceId) continue;
    const next = [...list];
    if (kind === 'contact' && (data.archived_at || data.merged_into_id)) {
      if (idx >= 0) next.splice(idx, 1);
    } else if (idx >= 0) {
      next[idx] = replace ? ({ ...data, id } as AnyRow) : { ...next[idx], ...data, id };
    } else {
      next.push({ exhibitor_id: exhibitorId, ...data, id } as AnyRow);
    }
    await put('cache', { ...c, [name]: next });
  }
  emitBoothChange();
}

/** Remplace partout un contact fusionné par le contact conservé. */
export async function applyContactMerge(userId: string, exhibitorId: string, fromId: string, toId: string) {
  const caches = await cachesForExhibitor(userId, exhibitorId);
  for (const c of caches) {
    await put('cache', {
      ...c,
      contacts: c.contacts.filter((r) => r.id !== fromId),
      interactions: c.interactions.map((r) => (r.contact_id === fromId ? { ...r, contact_id: toId } : r)),
      opportunities: c.opportunities.map((r) => (r.contact_id === fromId ? { ...r, contact_id: toId } : r)),
    });
  }
  emitBoothChange();
}
