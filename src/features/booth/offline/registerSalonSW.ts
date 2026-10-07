import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SALON_OFFLINE_ENABLED } from '@/lib/booth/config';
import { readCache } from '@/features/booth/sync/cache';

let preloaded = false;
function preloadLazyModules() {
  if (preloaded || !navigator.onLine) return;
  preloaded = true;
  // Charge le décodeur QR pour qu'il soit en cache (iPhone n'a pas BarcodeDetector).
  import('jsqr').catch(() => {
    preloaded = false;
  });
}

function canRegister() {
  try {
    return (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      import.meta.env.PROD &&
      window.self === window.top &&
      !window.location.hostname.includes('lovable')
    );
  } catch {
    return false;
  }
}

export function registerSalonSW() {
  if (!canRegister()) return;
  const sw = navigator.serviceWorker;

  if (!SALON_OFFLINE_ENABLED) {
    sw.getRegistrations()
      .then((regs) => {
        regs
          .filter((r) => new URL(r.scope).pathname === '/salon/')
          .forEach((r) => {
            (r.active ?? r.waiting ?? r.installing)?.postMessage('SALON_SW_DISABLE');
            void r.unregister();
          });
      })
      .catch(() => undefined);
    return;
  }

  navigator.serviceWorker.register('/salon-sw.js', { scope: '/salon/' }).catch(() => undefined);
  if (sw.controller) preloadLazyModules();
  else sw.addEventListener('controllerchange', preloadLazyModules, { once: true });
}

/** Vrai quand le service worker contrôle la page et qu'un cache local du salon existe. */
export function useOfflineReady(workspaceId: string, refreshKey?: unknown) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [hasController, setHasController] = useState(
    () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
  );
  const [hasCache, setHasCache] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const h = () => setHasController(!!navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', h);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', h);
  }, []);

  useEffect(() => {
    if (!userId || !workspaceId) return;
    let cancelled = false;
    readCache(userId, workspaceId)
      .then((c) => !cancelled && setHasCache(!!c))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, workspaceId, refreshKey]);

  return hasController && hasCache;
}
