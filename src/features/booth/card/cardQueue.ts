import { useEffect, useState } from 'react';
import { del, get, getAllByPrefix, put } from '../storage/db';
import { linkCardScan, scanCard, type BoothCardFields } from '@/lib/booth/rpc';
import { getSyncState, enqueue } from '../sync/engine';
import { onBoothChange, readCache } from '../sync/cache';
import { linkCardScanLater } from './useCardScanAvailable';

export const PROVISIONAL_COMPANY = 'Carte à traiter';
const MAX_ATTEMPTS = 3;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export type CardState = 'pending' | 'read' | 'unreadable' | 'blocked';

export interface CardItem {
  key: string;
  scanId: string;
  userId: string;
  exhibitorId: string;
  workspaceId: string;
  kind: 'card' | 'badge';
  base64: string;
  contactId: string | null;
  interactionId: string | null;
  createdAt: string;
  state: CardState;
  attempts: number;
  error?: string;
}

const cardKey = (userId: string, workspaceId: string, scanId: string) => `cardq|${userId}|${workspaceId}|${scanId}`;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export function onCardChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function addCard(item: Omit<CardItem, 'key' | 'state' | 'attempts' | 'createdAt'>) {
  await put('meta', {
    ...item,
    key: cardKey(item.userId, item.workspaceId, item.scanId),
    state: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  } satisfies CardItem);
  emit();
}

export const listCards = (userId: string, workspaceId: string) =>
  getAllByPrefix<CardItem>('meta', `cardq|${userId}|${workspaceId}|`);

export async function updateCard(userId: string, workspaceId: string, scanId: string, patch: Partial<CardItem>) {
  const k = cardKey(userId, workspaceId, scanId);
  const cur = await get<CardItem>('meta', k);
  if (!cur) return;
  await put('meta', { ...cur, ...patch, key: k });
  emit();
}

export async function removeCard(userId: string, workspaceId: string, scanId: string) {
  await del('meta', cardKey(userId, workspaceId, scanId));
  emit();
}

export async function removeCardsForContact(userId: string, workspaceId: string, contactId: string) {
  const items = await listCards(userId, workspaceId);
  for (const c of items.filter((x) => x.contactId === contactId)) await del('meta', c.key);
  emit();
}

export async function purgeOldCards(userId: string, workspaceId: string) {
  const now = Date.now();
  const items = await listCards(userId, workspaceId);
  let changed = false;
  for (const c of items) {
    if (now - new Date(c.createdAt).getTime() > MAX_AGE_MS) {
      await del('meta', c.key);
      changed = true;
    }
  }
  if (changed) emit();
}

/** Nombre de cartes en attente de lecture, tous salons confondus, pour un utilisateur. */
export async function countPendingCardsForUser(userId: string) {
  const items = await getAllByPrefix<CardItem>('meta', `cardq|${userId}|`);
  return items.filter((c) => c.state === 'pending').length;
}

const errCode = (e: unknown) => String((e as { message?: string })?.message ?? e ?? '');

const running = new Set<string>();
let paused = 0;
/** Suspend la lecture des cartes pendant un parcours de rencontre (évite tout traitement lourd en parallèle). */
export function pauseCardQueue() {
  paused++;
  return () => {
    paused = Math.max(0, paused - 1);
  };
}

/** Supprime les cartes jamais reliées à un contact, sauf celle du brouillon en cours. */
export async function purgeOrphanCards(userId: string, workspaceId: string, keepScanId: string | null) {
  const items = await listCards(userId, workspaceId);
  let changed = false;
  for (const c of items) {
    if (!c.contactId && c.scanId !== keepScanId) {
      await del('meta', c.key);
      changed = true;
    }
  }
  if (changed) emit();
}

/** Lit les cartes en attente une par une (une seule exécution à la fois). */
export async function processCardQueue(userId: string, workspaceId: string) {
  const runKey = `${userId}|${workspaceId}`;
  if (running.has(runKey) || paused > 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  running.add(runKey);
  try {
    const items = (await listCards(userId, workspaceId))
      .filter((c) => c.state === 'pending' && c.contactId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const c of items) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
      try {
        const res = await scanCard({
          workspaceId,
          scanId: c.scanId,
          kind: c.kind,
          imageBase64: c.base64,
          mediaType: 'image/jpeg',
        });
        if (res.status !== 'ok' || !res.fields) {
          await updateCard(userId, workspaceId, c.scanId, { state: 'unreadable' });
          continue;
        }
        await applyFields(c, res.fields, res.company_domain ?? null);
        try {
          await linkCardScan(c.scanId, c.contactId!);
        } catch {
          linkCardScanLater(userId, c.scanId, c.contactId!);
        }
        await updateCard(userId, workspaceId, c.scanId, { state: 'read' });
      } catch (e) {
        const m = errCode(e);
        const blocked = ['BOOTH_PLAN_REQUIRED', 'BOOTH_RATE_LIMITED', 'BOOTH_WORKSPACE_ARCHIVED'].find((k) => m.includes(k));
        if (blocked) {
          await updateCard(userId, workspaceId, c.scanId, { state: 'blocked', error: blocked });
        } else if (m.includes('BOOTH_NETWORK')) {
          break; // réseau perdu : on reprendra au prochain passage
        } else {
          const attempts = c.attempts + 1;
          await updateCard(userId, workspaceId, c.scanId, {
            attempts,
            state: attempts >= MAX_ATTEMPTS ? 'unreadable' : 'pending',
          });
        }
      }
    }
  } finally {
    running.delete(runKey);
  }
}

async function applyFields(c: CardItem, f: BoothCardFields, domain: string | null) {
  const cache = await readCache(c.userId, c.workspaceId);
  const contact = cache?.contacts.find((x) => x.id === c.contactId);
  const empty = (v: unknown) => v === null || v === undefined || String(v).trim() === '';
  const cur = (k: string) => (contact as unknown as Record<string, unknown> | undefined)?.[k];
  const data: Record<string, unknown> = {};
  const set = (k: string, v: string | null | undefined) => {
    if (!v) return;
    const now = cur(k);
    if (empty(now) || (k === 'company_name' && now === PROVISIONAL_COMPANY)) data[k] = v;
  };
  set('first_name', f.first_name);
  set('last_name', f.last_name);
  set('company_name', f.company_name);
  set('job_title', f.job_title);
  set('email', f.email);
  set('phone', f.mobile || f.phone);
  set('linkedin_url', f.linkedin_url);
  if (data.company_name) set('company_domain', domain);
  if (Object.keys(data).length > 0) await enqueue(c.userId, c.exhibitorId, 'contact', c.contactId!, data);
}

/** Déclenche la lecture : au montage, au retour du réseau et après chaque synchronisation réussie. */
export function useCardQueueRunner(userId: string | undefined, exhibitorId: string | undefined, workspaceId: string) {
  useEffect(() => {
    if (!userId || !exhibitorId || !workspaceId) return;
    void purgeOldCards(userId, workspaceId).then(() => processCardQueue(userId, workspaceId));
    const onOnline = () => void processCardQueue(userId, workspaceId);
    window.addEventListener('online', onOnline);
    let last = getSyncState(userId, exhibitorId).lastSyncAt;
    const off = onBoothChange(() => {
      const s = getSyncState(userId, exhibitorId);
      if (!s.syncing && s.lastSyncAt && s.lastSyncAt !== last) {
        last = s.lastSyncAt;
        void processCardQueue(userId, workspaceId);
      }
    });
    return () => {
      window.removeEventListener('online', onOnline);
      off();
    };
  }, [userId, exhibitorId, workspaceId]);
}

/** Liste réactive des cartes du salon. */
export function useCards(userId: string | undefined, workspaceId: string) {
  const [items, setItems] = useState<CardItem[]>([]);
  useEffect(() => {
    if (!userId) return;
    const read = () => void listCards(userId, workspaceId).then(setItems).catch(() => undefined);
    read();
    return onCardChange(read);
  }, [userId, workspaceId]);
  return items;
}

export const cardImageUrl = (c: CardItem) => `data:image/jpeg;base64,${c.base64}`;
