import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { bootstrap } from '@/lib/booth/rpc';
import { onBoothChange, readCache, writeCache, mergeBootstrap, type BoothCache } from './sync/cache';
import { listOutbox } from './sync/engine';

export type WorkspaceLoadState = 'loading' | 'ready' | 'stale' | 'forbidden' | 'error';

export function useBoothWorkspace(workspaceId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [cache, setCache] = useState<BoothCache | null>(null);
  const [status, setStatus] = useState<WorkspaceLoadState>('loading');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!userId || !workspaceId) return;
    let cancelled = false;

    (async () => {
      const local = await readCache(userId, workspaceId);
      if (cancelled) return;
      if (local) {
        setCache(local);
        setStatus('ready');
      }
      try {
        const b = await bootstrap(workspaceId, local?.next_since ?? null);
        const pending = await listOutbox(userId, b.workspace.exhibitor_id);
        const latest = await readCache(userId, workspaceId);
        const merged = mergeBootstrap(userId, workspaceId, latest ?? undefined, b, new Set(pending.map((p) => p.id)));
        await writeCache(merged);
        if (cancelled) return;
        setCache(merged);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        const msg = String((e as { message?: string })?.message ?? '');
        setError(e);
        if (msg.includes('BOOTH_NOT_FOUND') || msg.includes('BOOTH_FORBIDDEN')) setStatus('forbidden');
        else setStatus(local ? 'stale' : 'error');
      }
    })();

    const off = onBoothChange(async () => {
      const c = await readCache(userId, workspaceId);
      if (!cancelled && c) setCache(c);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [userId, workspaceId]);

  return { cache, status, error };
}
