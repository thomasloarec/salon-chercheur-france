import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { onBoothChange } from './cache';
import { getSyncState, listOutbox, registerWorkspace, syncNow as runSync, type OutboxItem } from './engine';

const INTERVAL = 30_000;

export function useBoothSync(workspaceId: string, exhibitorId: string | null) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !exhibitorId) return;
    setItems(await listOutbox(userId, exhibitorId));
    const s = getSyncState(userId, exhibitorId);
    setSyncing(s.syncing);
    setLastSyncAt(s.lastSyncAt);
  }, [userId, exhibitorId]);

  const syncNow = useCallback(() => {
    if (userId && exhibitorId) void runSync(userId, exhibitorId);
  }, [userId, exhibitorId]);

  useEffect(() => {
    if (!userId || !exhibitorId) return;
    registerWorkspace(userId, exhibitorId, workspaceId);
    void refresh();
    const off = onBoothChange(() => void refresh());
    const goOnline = () => {
      setOnline(true);
      syncNow();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncNow();
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(syncNow, INTERVAL);
    syncNow();
    return () => {
      off();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [userId, exhibitorId, workspaceId, refresh, syncNow]);

  return {
    pendingCount: items.filter((i) => i.state === 'pending').length,
    rejectedCount: items.filter((i) => i.state === 'rejected').length,
    rejectedItems: items.filter((i) => i.state === 'rejected'),
    lastSyncAt,
    online,
    syncing,
    syncNow,
  };
}
