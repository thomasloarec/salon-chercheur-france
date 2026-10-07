import { useEffect, useState } from 'react';
import { del, getAllByPrefix, put } from '../storage/db';
import { linkCardScan, listWorkspaces } from '@/lib/booth/rpc';

const availKey = (userId: string, workspaceId: string) => `cardscan|${userId}|${workspaceId}`;
const linkKey = (userId: string, scanId: string) => `cardlink|${userId}|${scanId}`;

/**
 * Lecture de carte disponible pour ce salon.
 * Sans réseau : toujours true (la carte passera en « Lecture non incluse » au retour du réseau si besoin).
 * Avec réseau : réponse du serveur ; en cas d'échec de l'appel, true. Jamais masqué pendant le chargement.
 */
export function useCardScanAvailable(userId: string, exhibitorId: string, workspaceId: string, online: boolean) {
  const [serverValue, setServerValue] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    setServerValue(null);
    if (!online) return;
    (async () => {
      try {
        const r = await listWorkspaces(exhibitorId);
        const ws = r?.items?.find((w) => w.workspace_id === workspaceId);
        if (!ws || cancelled) return;
        const v = !!ws.full_features;
        setServerValue(v);
        await put('meta', { key: availKey(userId, workspaceId), value: { value: v, at: new Date().toISOString() } });
      } catch {
        // échec de l'appel : le bouton reste visible
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, exhibitorId, workspaceId, online]);
  if (!online) return true;
  return serverValue ?? true;
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
