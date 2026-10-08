import { useEffect, useState } from 'react';
import { del, get, getAllByPrefix, put } from '../storage/db';
import { linkVoiceNote, voiceNote } from '@/lib/booth/rpc';
import { enqueue, getSyncState } from '../sync/engine';
import { onBoothChange, readCache } from '../sync/cache';

const MAX_ATTEMPTS = 3;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export type VoiceItemState = 'pending' | 'blocked';

export interface VoiceItem {
  key: string;
  noteId: string;
  userId: string;
  exhibitorId: string;
  workspaceId: string;
  interactionId: string;
  base64: string;
  mediaType: string;
  durationMs: number;
  createdAt: string;
  state: VoiceItemState;
  attempts: number;
  error?: string;
}

const voiceKey = (userId: string, workspaceId: string, noteId: string) => `voiceq|${userId}|${workspaceId}|${noteId}`;
const linkKey = (userId: string, noteId: string) => `voicelink|${userId}|${noteId}`;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
export function onVoiceChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function addVoice(item: Omit<VoiceItem, 'key' | 'state' | 'attempts' | 'createdAt'>) {
  await put('meta', {
    ...item,
    key: voiceKey(item.userId, item.workspaceId, item.noteId),
    state: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  } satisfies VoiceItem);
  emit();
}

export const listVoice = (userId: string, workspaceId: string) =>
  getAllByPrefix<VoiceItem>('meta', `voiceq|${userId}|${workspaceId}|`);

async function patchVoice(item: VoiceItem, patch: Partial<VoiceItem>) {
  const cur = await get<VoiceItem>('meta', item.key);
  if (!cur) return;
  await put('meta', { ...cur, ...patch, key: item.key });
  emit();
}

/** Supprime l'enregistrement de l'appareil. */
export async function removeVoice(userId: string, workspaceId: string, noteId: string) {
  await del('meta', voiceKey(userId, workspaceId, noteId));
  emit();
}

/** Relie une note à une rencontre ; en cas d'échec, mis de côté pour plus tard. */
export function linkVoiceNoteLater(userId: string, noteId: string, interactionId: string) {
  linkVoiceNote(noteId, interactionId).catch(() => {
    void put('meta', { key: linkKey(userId, noteId), value: { noteId, interactionId } }).catch(() => undefined);
  });
}

export async function flushVoiceLinks(userId: string) {
  const rows = await getAllByPrefix<{ key: string; value: { noteId: string; interactionId: string } }>(
    'meta',
    `voicelink|${userId}|`,
  ).catch(() => []);
  for (const r of rows) {
    try {
      await linkVoiceNote(r.value.noteId, r.value.interactionId);
      await del('meta', r.key);
    } catch {
      // nouvel essai plus tard
    }
  }
}

async function purgeOldVoice(userId: string, workspaceId: string) {
  const now = Date.now();
  let changed = false;
  for (const v of await listVoice(userId, workspaceId)) {
    if (now - new Date(v.createdAt).getTime() > MAX_AGE_MS) {
      await del('meta', v.key);
      changed = true;
    }
  }
  if (changed) emit();
}

/** Ajoute un texte à la fin de la note actuelle de la rencontre (lue dans le cache au moment de l'ajout). */
export async function appendToInteractionNote(userId: string, exhibitorId: string, workspaceId: string, interactionId: string, text: string) {
  const cache = await readCache(userId, workspaceId);
  const cur = cache?.interactions.find((x) => x.id === interactionId)?.note ?? '';
  const note = (cur.trim() ? `${cur.trim()}\n${text.trim()}` : text.trim()).slice(0, 2000);
  await enqueue(userId, exhibitorId, 'interaction', interactionId, { note });
}

const BLOCKING = ['BOOTH_VOICE_QUOTA', 'BOOTH_PLAN_REQUIRED', 'BOOTH_WORKSPACE_ARCHIVED', 'BOOTH_AUDIO_TOO_LONG', 'BOOTH_AUDIO_TOO_LARGE', 'BOOTH_FORBIDDEN'];
const running = new Set<string>();

/** Transcrit les notes en attente une par une. */
export async function processVoiceQueue(userId: string, workspaceId: string) {
  const runKey = `${userId}|${workspaceId}`;
  if (running.has(runKey)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  running.add(runKey);
  try {
    const cache = await readCache(userId, workspaceId);
    const known = new Set(cache?.interactions.map((i) => i.id) ?? []);
    const items = (await listVoice(userId, workspaceId))
      .filter((v) => v.state === 'pending' && known.has(v.interactionId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const v of items) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
      try {
        const res = await voiceNote({
          workspaceId,
          noteId: v.noteId,
          mode: 'note',
          audioBase64: v.base64,
          mediaType: v.mediaType,
          durationMs: v.durationMs,
        });
        const text = (res.transcript ?? '').trim();
        if (res.status === 'ok' && text) {
          await appendToInteractionNote(userId, v.exhibitorId, workspaceId, v.interactionId, text);
          linkVoiceNoteLater(userId, v.noteId, v.interactionId);
        }
        await removeVoice(userId, workspaceId, v.noteId);
      } catch (e) {
        const m = String((e as { message?: string })?.message ?? e ?? '');
        const blocked = BLOCKING.find((k) => m.includes(k));
        if (blocked) {
          await patchVoice(v, { state: 'blocked', error: blocked });
        } else if (m.includes('BOOTH_NETWORK') || m.includes('BOOTH_RATE_LIMITED')) {
          break; // on reprendra au prochain passage
        } else {
          const attempts = v.attempts + 1;
          await patchVoice(v, attempts >= MAX_ATTEMPTS ? { attempts, state: 'blocked', error: 'BOOTH_VOICE_FAILED' } : { attempts });
        }
      }
    }
  } finally {
    running.delete(runKey);
  }
}

/** Déclenche la transcription : au montage, au retour du réseau et après chaque synchronisation réussie. */
export function useVoiceQueueRunner(userId: string | undefined, exhibitorId: string | undefined, workspaceId: string) {
  useEffect(() => {
    if (!userId || !exhibitorId || !workspaceId) return;
    void purgeOldVoice(userId, workspaceId).then(() => processVoiceQueue(userId, workspaceId));
    void flushVoiceLinks(userId);
    const onOnline = () => {
      void processVoiceQueue(userId, workspaceId);
      void flushVoiceLinks(userId);
    };
    window.addEventListener('online', onOnline);
    let last = getSyncState(userId, exhibitorId).lastSyncAt;
    const off = onBoothChange(() => {
      const st = getSyncState(userId, exhibitorId);
      if (!st.syncing && st.lastSyncAt && st.lastSyncAt !== last) {
        last = st.lastSyncAt;
        void processVoiceQueue(userId, workspaceId);
      }
    });
    return () => {
      window.removeEventListener('online', onOnline);
      off();
    };
  }, [userId, exhibitorId, workspaceId]);
}

/** Liste réactive des notes vocales du salon. */
export function useVoiceItems(userId: string | undefined, workspaceId: string) {
  const [items, setItems] = useState<VoiceItem[]>([]);
  useEffect(() => {
    if (!userId) return;
    const read = () => void listVoice(userId, workspaceId).then(setItems).catch(() => undefined);
    read();
    return onVoiceChange(read);
  }, [userId, workspaceId]);
  return items;
}
