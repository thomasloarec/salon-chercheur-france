/**
 * Petit module IndexedDB natif (sans dépendance) pour Lotexpo Leads.
 * Bascule automatiquement sur un stockage en mémoire si IndexedDB est indisponible.
 */
export type StoreName = 'outbox' | 'cache' | 'meta';
const STORES: StoreName[] = ['outbox', 'cache', 'meta'];
const DB_NAME = 'lotexpo-leads';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { key: string } & Record<string, any>;

const memory: Record<StoreName, Map<string, Row>> = {
  outbox: new Map(),
  cache: new Map(),
  meta: new Map(),
};

let available = true;
let dbPromise: Promise<IDBDatabase | null> | null = null;
const availabilityListeners = new Set<() => void>();

export const isPersistentStorage = () => available;
export function onStorageAvailabilityChange(fn: () => void) {
  availabilityListeners.add(fn);
  return () => availabilityListeners.delete(fn);
}

function markUnavailable() {
  if (!available) return;
  available = false;
  availabilityListeners.forEach((f) => f());
}

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        markUnavailable();
        return resolve(null);
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((s) => {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'key' });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        markUnavailable();
        resolve(null);
      };
      req.onblocked = () => {
        markUnavailable();
        resolve(null);
      };
    } catch {
      markUnavailable();
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) return reject(new Error('NO_IDB'));
        try {
          const tx = db.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => reject(req.error);
        } catch (e) {
          reject(e);
        }
      }),
  );
}

export async function get<T extends Row>(store: StoreName, key: string): Promise<T | undefined> {
  if (!available) return memory[store].get(key) as T | undefined;
  try {
    return await run<T | undefined>(store, 'readonly', (s) => s.get(key));
  } catch {
    markUnavailable();
    return memory[store].get(key) as T | undefined;
  }
}

export async function put<T extends Row>(store: StoreName, value: T): Promise<void> {
  memory[store].set(value.key, value);
  if (!available) return;
  try {
    await run(store, 'readwrite', (s) => s.put(value));
  } catch {
    markUnavailable();
  }
}

export async function del(store: StoreName, key: string): Promise<void> {
  memory[store].delete(key);
  if (!available) return;
  try {
    await run(store, 'readwrite', (s) => s.delete(key));
  } catch {
    markUnavailable();
  }
}

export async function getAllByPrefix<T extends Row>(store: StoreName, prefix: string): Promise<T[]> {
  const fromMemory = () =>
    Array.from(memory[store].values()).filter((r) => r.key.startsWith(prefix)) as T[];
  if (!available) return fromMemory();
  try {
    return await run<T[]>(store, 'readonly', (s) =>
      s.getAll(IDBKeyRange.bound(prefix, prefix + '\uffff')),
    );
  } catch {
    markUnavailable();
    return fromMemory();
  }
}
