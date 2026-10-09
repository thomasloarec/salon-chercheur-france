import { applyLocalRow, sanitizeCache, type BoothCache } from '../cache';

const store = new Map<string, BoothCache>();
jest.mock('../../storage/db', () => ({
  get: async (_s: string, k: string) => store.get(k),
  put: async (_s: string, v: BoothCache) => { store.set(v.key, v); },
  getAllByPrefix: async (_s: string, p: string) => [...store.values()].filter((c) => c.key.startsWith(p)),
}));

const U = 'u1', EX = 'ex1';
const mk = (ws: string, extra: Partial<BoothCache> = {}): BoothCache => ({
  key: `${U}|${ws}`, userId: U, workspaceId: ws, exhibitorId: EX,
  workspace: {} as BoothCache['workspace'], team: [], contacts: [], contacts_total: 0, contacts_truncated: false,
  interactions: [], opportunities: [], inbound_leads: [], role: 'member' as BoothCache['role'], me: U,
  full_features: true, next_since: null, saved_at: '', ...extra,
});
const it0 = (id: string, ws?: string) => ({ id, workspace_id: ws, occurred_at: '2026-10-01T10:00:00Z', note: 'x' }) as never;

beforeEach(() => store.clear());

test('mise à jour d’une rencontre existante seulement dans A', async () => {
  store.set(`${U}|A`, mk('A', { interactions: [it0('i1', 'A')] }));
  store.set(`${U}|B`, mk('B'));
  await applyLocalRow(U, EX, 'interaction', 'i1', { note: 'nouvelle' });
  expect((store.get(`${U}|A`)!.interactions[0] as { note: string }).note).toBe('nouvelle');
  expect(store.get(`${U}|B`)!.interactions).toHaveLength(0);
});

test('création ajoutée seulement au salon indiqué', async () => {
  store.set(`${U}|A`, mk('A'));
  store.set(`${U}|B`, mk('B'));
  await applyLocalRow(U, EX, 'interaction', 'i2', { workspace_id: 'A', occurred_at: '2026-10-01T10:00:00Z' });
  expect(store.get(`${U}|A`)!.interactions).toHaveLength(1);
  expect(store.get(`${U}|B`)!.interactions).toHaveLength(0);
});

test('sanitizeCache retire les lignes sans salon ou d’un autre salon', () => {
  const { cache, removed } = sanitizeCache(mk('A', { interactions: [it0('ok', 'A'), it0('none'), it0('other', 'B')] }));
  expect(removed).toBe(true);
  expect(cache.interactions.map((i) => i.id)).toEqual(['ok']);
});

test('un contact modifié est appliqué aux deux caches', async () => {
  const c = { id: 'c1', first_name: 'A' } as never;
  store.set(`${U}|A`, mk('A', { contacts: [c] }));
  store.set(`${U}|B`, mk('B', { contacts: [c] }));
  await applyLocalRow(U, EX, 'contact', 'c1', { first_name: 'Zoé' });
  expect((store.get(`${U}|A`)!.contacts[0] as { first_name: string }).first_name).toBe('Zoé');
  expect((store.get(`${U}|B`)!.contacts[0] as { first_name: string }).first_name).toBe('Zoé');
});
