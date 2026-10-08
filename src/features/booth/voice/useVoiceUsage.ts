import { useEffect, useState } from 'react';
import { get, put } from '../storage/db';
import { voiceUsage } from '@/lib/booth/rpc';

const key = (userId: string, workspaceId: string) => `voiceusage|${userId}|${workspaceId}`;

/** Notes vocales restantes ce mois-ci (mis en cache) ; null hors réseau ou inconnu. */
export function useVoiceRemaining(userId: string, workspaceId: string, online: boolean, enabled: boolean) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void get<{ key: string; value: number }>('meta', key(userId, workspaceId))
      .then((r) => { if (!cancelled && r && typeof r.value === 'number') setRemaining(r.value); })
      .catch(() => undefined);
    if (online) {
      voiceUsage(workspaceId)
        .then((u) => {
          if (cancelled || typeof u?.remaining_month !== 'number') return;
          setRemaining(u.remaining_month);
          void put('meta', { key: key(userId, workspaceId), value: u.remaining_month }).catch(() => undefined);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [userId, workspaceId, online, enabled]);
  const update = (n: number | undefined) => {
    if (typeof n !== 'number') return;
    setRemaining(n);
    void put('meta', { key: key(userId, workspaceId), value: n }).catch(() => undefined);
  };
  return { remaining: online ? remaining : null, update };
}

export const remainingLabel = (n: number | null) =>
  n === null ? null : `${n} note${n > 1 ? 's' : ''} vocale${n > 1 ? 's' : ''} restante${n > 1 ? 's' : ''} ce mois-ci`;
