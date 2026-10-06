import { toast } from '@/hooks/use-toast';
import { bootstrap, sync, type BoothSyncItem, type BoothSyncKind } from '@/lib/booth/rpc';
import { del, getAllByPrefix, put } from '../storage/db';
import {
  applyContactMerge,
  applyLocalRow,
  emitBoothChange,
  mergeBootstrap,
  readCache,
  writeCache,
} from './cache';

export interface OutboxItem {
  key: string;
  userId: string;
  exhibitorId: string;
  kind: BoothSyncKind;
  id: string;
  data: Record<string, unknown>;
  client_updated_at: string;
  state: 'pending' | 'rejected';
  error?: string;
  attempts: number;
  updated_at: string;
}

const KIND_ORDER: Record<BoothSyncKind, number> = { contact: 0, interaction: 1, opportunity: 2 };
const BACKOFF = [10_000, 30_000, 60_000];
const MAX_BATCH = 200;

const outboxKey = (userId: string, exhibitorId: string, kind: BoothSyncKind, id: string) =>
  `${userId}|${exhibitorId}|${kind}|${id}`;
const ctxKey = (userId: string, exhibitorId: string) => `${userId}|${exhibitorId}`;

interface CtxState {
  syncing: boolean;
  rerun: boolean;
  lastSyncAt: string | null;
  failures: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  workspaces: Set<string>;
}
const states = new Map<string, CtxState>();

function state(userId: string, exhibitorId: string): CtxState {
  const k = ctxKey(userId, exhibitorId);
  let s = states.get(k);
  if (!s) {
    s = { syncing: false, rerun: false, lastSyncAt: null, failures: 0, retryTimer: null, workspaces: new Set() };
    states.set(k, s);
  }
  return s;
}

export function getSyncState(userId: string, exhibitorId: string) {
  const s = state(userId, exhibitorId);
  return { syncing: s.syncing, lastSyncAt: s.lastSyncAt };
}

export function registerWorkspace(userId: string, exhibitorId: string, workspaceId: string) {
  state(userId, exhibitorId).workspaces.add(workspaceId);
}

export const listOutbox = (userId: string, exhibitorId: string) =>
  getAllByPrefix<OutboxItem>('outbox', `${ctxKey(userId, exhibitorId)}|`);

export const newId = () => crypto.randomUUID();

export async function enqueue(
  userId: string,
  exhibitorId: string,
  kind: BoothSyncKind,
  id: string,
  data: Record<string, unknown>,
) {
  const key = outboxKey(userId, exhibitorId, kind, id);
  const now = new Date().toISOString();
  const existing = (await getAllByPrefix<OutboxItem>('outbox', key)).find((r) => r.key === key);
  const item: OutboxItem = {
    key,
    userId,
    exhibitorId,
    kind,
    id,
    data: { ...(existing?.data ?? {}), ...data },
    client_updated_at: now,
    state: 'pending',
    attempts: existing?.attempts ?? 0,
    updated_at: now,
  };
  await put('outbox', item);
  await applyLocalRow(userId, exhibitorId, kind, id, { ...data, client_updated_at: now });
  void syncNow(userId, exhibitorId);
}

export async function retryRejected(item: OutboxItem) {
  await put('outbox', { ...item, state: 'pending', error: undefined, updated_at: new Date().toISOString() });
  emitBoothChange();
  void syncNow(item.userId, item.exhibitorId);
}

export async function abandon(item: OutboxItem) {
  await del('outbox', item.key);
  emitBoothChange();
}

const errorCode = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? e ?? '');
  const match = m.match(/BOOTH_[A-Z_]+/);
  return match ? match[0] : null;
};

function scheduleRetry(userId: string, exhibitorId: string) {
  const s = state(userId, exhibitorId);
  if (s.retryTimer) clearTimeout(s.retryTimer);
  const delay = BACKOFF[Math.min(s.failures - 1, BACKOFF.length - 1)];
  s.retryTimer = setTimeout(() => {
    s.retryTimer = null;
    void syncNow(userId, exhibitorId);
  }, delay);
}

async function refreshWorkspaces(userId: string, exhibitorId: string) {
  const s = state(userId, exhibitorId);
  const pending = await listOutbox(userId, exhibitorId);
  const pendingIds = new Set(pending.map((p) => p.id));
  for (const wsId of s.workspaces) {
    try {
      const prev = await readCache(userId, wsId);
      const b = await bootstrap(wsId, prev?.next_since ?? null);
      await writeCache(mergeBootstrap(userId, wsId, prev, b, pendingIds));
    } catch {
      // le prochain cycle réessaiera
    }
  }
}

/** Envoie la file au serveur. Une seule synchronisation à la fois par exposant. */
export async function syncNow(userId: string, exhibitorId: string): Promise<void> {
  const s = state(userId, exhibitorId);
  if (s.syncing) {
    s.rerun = true;
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emitBoothChange();
    return;
  }
  s.syncing = true;
  emitBoothChange();
  let sentSomething = false;
  try {
    const all = await listOutbox(userId, exhibitorId);
    const batch = all
      .filter((i) => i.state === 'pending')
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.client_updated_at.localeCompare(b.client_updated_at))
      .slice(0, MAX_BATCH);

    if (batch.length > 0) {
      const items: BoothSyncItem[] = batch.map((i) => ({
        kind: i.kind,
        id: i.id,
        data: i.data,
        client_updated_at: i.client_updated_at,
      }));
      let res;
      try {
        res = await sync(exhibitorId, items);
      } catch {
        s.failures += 1;
        scheduleRetry(userId, exhibitorId);
        return;
      }
      s.failures = 0;
      sentSomething = true;
      let staleSeen = false;

      for (const r of res.results ?? []) {
        const sent = batch[r.index];
        if (!sent) continue;
        const current = (await getAllByPrefix<OutboxItem>('outbox', sent.key)).find((x) => x.key === sent.key);
        const unchangedSince = current && current.client_updated_at === sent.client_updated_at;

        switch (r.status) {
          case 'created':
          case 'updated':
          case 'unchanged':
            if (unchangedSince) await del('outbox', sent.key);
            if (r.row && unchangedSince) await applyLocalRow(userId, exhibitorId, sent.kind, sent.id, r.row);
            break;
          case 'stale':
            await del('outbox', sent.key);
            if (r.row) await applyLocalRow(userId, exhibitorId, sent.kind, sent.id, r.row, true);
            staleSeen = true;
            break;
          case 'merged':
            await del('outbox', sent.key);
            if (r.merged_into_id && sent.kind === 'contact') {
              await applyContactMerge(userId, exhibitorId, sent.id, r.merged_into_id);
            }
            break;
          case 'error':
            if (!current) break;
            if (!r.error || r.error === 'BOOTH_ERROR') {
              await put('outbox', { ...current, attempts: current.attempts + 1 });
            } else {
              await put('outbox', { ...current, state: 'rejected', error: r.error, attempts: current.attempts + 1 });
            }
            break;
        }
      }
      if (staleSeen) {
        toast({ description: 'Une modification plus récente faite par un collègue a été conservée.' });
      }
      s.lastSyncAt = new Date().toISOString();
    } else {
      s.lastSyncAt = s.lastSyncAt ?? new Date().toISOString();
    }

    if (sentSomething || batch.length === 0) await refreshWorkspaces(userId, exhibitorId);
  } catch (e) {
    // erreur inattendue : on garde tout et on réessaie plus tard
    void errorCode(e);
    s.failures += 1;
    scheduleRetry(userId, exhibitorId);
  } finally {
    s.syncing = false;
    emitBoothChange();
    if (s.rerun) {
      s.rerun = false;
      void syncNow(userId, exhibitorId);
    }
  }
}

/** Synchronise tous les exposants qui ont des éléments en attente pour cet utilisateur. */
export async function syncAllForUser(userId: string) {
  const items = await getAllByPrefix<OutboxItem>('outbox', `${userId}|`);
  const exhibitors = Array.from(new Set(items.filter((i) => i.state === 'pending').map((i) => i.exhibitorId)));
  for (const ex of exhibitors) {
    await syncNow(userId, ex);
    // attendre une éventuelle relance programmée pendant l'envoi
    while (state(userId, ex).syncing) await new Promise((r) => setTimeout(r, 200));
  }
}
