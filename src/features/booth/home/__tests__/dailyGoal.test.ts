import type { BoothCache } from '../../sync/cache';

const store = new Map<string, BoothCache>();
const calls: unknown[][] = [];
jest.mock('../../storage/db', () => ({
  get: async (_s: string, k: string) => store.get(k),
  put: async (_s: string, v: BoothCache) => { store.set(v.key, v); },
  getAllByPrefix: async () => [],
}));
jest.mock('@/lib/booth/rpc', () => ({
  setDailyGoal: async (...a: unknown[]) => { calls.push(a); return null; },
}));

import { saveDailyGoal } from '../dailyGoal';

const mk = (): BoothCache => ({
  key: 'u1|w1', userId: 'u1', workspaceId: 'w1', exhibitorId: 'e1',
  workspace: { workspace_id: 'w1', daily_goal: null } as unknown as BoothCache['workspace'],
  team: [], contacts: [], contacts_total: 0, contacts_truncated: false, interactions: [], opportunities: [],
  inbound_leads: [], role: 'manager' as BoothCache['role'], me: 'u1', full_features: true, next_since: null, saved_at: '',
});

test('setDailyGoal met à jour le cache', async () => {
  store.set('u1|w1', mk());
  await saveDailyGoal('u1', 'w1', 12);
  expect(calls[0]).toEqual(['w1', 12]);
  expect(store.get('u1|w1')!.workspace.daily_goal).toBe(12);
  await saveDailyGoal('u1', 'w1', null);
  expect(store.get('u1|w1')!.workspace.daily_goal).toBeNull();
});
