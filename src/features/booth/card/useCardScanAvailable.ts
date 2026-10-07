import { useEffect, useState } from 'react';
import { del, get, getAllByPrefix, put } from '../storage/db';
import { linkCardScan, listWorkspaces } from '@/lib/booth/rpc';

const availKey = (userId: string, workspaceId: string) => `cardscan|${userId}|${workspaceId}`;
const linkKey = (userId: string, scanId: string) => `cardlink|${userId}|${scanId}`;

/** Lecture de carte disponible pour ce salon (valeur inconnue : true, le serveur refusera proprement). */
export function useCardScanAvailable(userId: string, exhibitorId: string, workspaceId: string, online: boolean) {
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await get<{ key: string; value: boolean }>('meta', availKey(userId, workspaceId)).catch(() => undefined);
      if (!cancelled && typeof stored?.value === 'boolean') setAvailable(stored.value);
      if (!online) return;
      try {
        const r = await listWorkspaces(exhibitorId);
        const ws = r?.items?.find((w) => w.workspace_id === workspaceId);
        if (!ws || cancelled) return;
        const v = !!ws.full_features;
        setAvailable(v);
        await put('meta', { key: availKey(userId, workspaceId), value: v });
      } catch {
        // garder la valeur connue
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, exhibitorId, workspaceId, online]);
  return available;
}

/** Relie une lecture à un contact, sans attendre ; en cas d'échec, mis de côté pour plus tard. */
export function linkCardScanLater(userId: string, scanId: string, contactId: string) {
  linkCardScan(scanId, contactId).catch(() => {
    void put('meta', { key: linkKey(userId, scanId), value: { scanId, contactId } }).catch(() => undefined);
  });
}

/** Renvoie les liaisons en attente (au retour en ligne). */
export async function flushCardLinks(userId: string) {
  const rows = await getAllByPrefix<{ key: string; value: { scanId: string; contactId: string } }>(
    'meta',
    `cardlink|${userId}|`,
  ).catch(() => []);
  for (const r of rows) {
    try {
      await linkCardScan(r.value.scanId, r.value.contactId);
      await del('meta', r.key);
    } catch {
      // nouvel essai plus tard
    }
  }
}
