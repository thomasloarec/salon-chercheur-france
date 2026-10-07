import { computeMetrics } from '../metrics';
import type { Interaction, Opportunity } from '@/lib/booth/types';

const WS = 'ws1';
const A = 'userA';
const B = 'userB';

const it_ = (p: Partial<Interaction>): Interaction =>
  ({
    workspace_id: WS,
    exhibitor_id: 'ex',
    contact_id: 'c' + p.id,
    owner_user_id: A,
    created_by: A,
    relationship: 'new_prospect',
    customer_topic: null,
    potential: null,
    is_field_lead: false,
    next_action: 'none',
    next_action_due: null,
    next_action_done_at: null,
    next_action_owner_id: null,
    note: null,
    capture_source: 'manual',
    inbound_lead_id: null,
    status: 'completed',
    client_updated_at: null,
    created_at: '',
    updated_at: '',
    ...p,
  }) as Interaction;

const op = (p: Partial<Opportunity>): Opportunity =>
  ({
    workspace_id: WS,
    exhibitor_id: 'ex',
    contact_id: 'x',
    origin_interaction_id: null,
    title: null,
    value_band: null,
    amount: null,
    currency: 'EUR',
    horizon: null,
    probability: null,
    status: 'open',
    won_amount: null,
    won_at: null,
    lost_at: null,
    owner_user_id: A,
    created_by: A,
    client_updated_at: null,
    ...p,
  }) as Opportunity;

const cache = {
  workspaceId: WS,
  workspace: {
    workspace_id: WS, exhibitor_id: 'ex', event_id: 'e', nom_event: 'Salon', event_slug: null, ville: null,
    date_debut: '2026-10-06', date_fin: '2026-10-07', stand_label: null, timezone: 'Europe/Paris',
    currency: 'EUR', total_cost: 1000, archived: false, phase: 'live',
  } as never,
  interactions: [
    // Jour 1 (6 oct.)
    it_({ id: '1', occurred_at: '2026-10-06T08:00:00Z', potential: 'hot', next_action: 'call', next_action_due: '2026-10-06' }),
    it_({ id: '2', occurred_at: '2026-10-06T09:00:00Z', potential: 'good', owner_user_id: B }),
    it_({ id: '3', occurred_at: '2026-10-06T10:00:00Z', relationship: 'customer', potential: 'hot', owner_user_id: B }),
    it_({ id: '4', occurred_at: '2026-10-06T11:00:00Z', status: 'cancelled', potential: 'hot' }),
    // 23 h 30 à Paris le 6 oct. = 21 h 30 UTC
    it_({ id: '5', occurred_at: '2026-10-06T21:30:00Z', potential: 'explore', contact_id: 'c1' }),
    // Jour 2
    it_({ id: '6', occurred_at: '2026-10-07T08:00:00Z', potential: 'none', next_action: 'email', next_action_done_at: '2026-10-07T10:00:00Z' }),
    it_({ id: '7', occurred_at: '2026-10-07T09:00:00Z', relationship: 'partner', owner_user_id: B }),
  ],
  opportunities: [
    op({ id: 'o1', origin_interaction_id: '1', amount: 5000 }),
    op({ id: 'o2', origin_interaction_id: '2', owner_user_id: B }),
    op({ id: 'o3', origin_interaction_id: '6', status: 'abandoned', amount: 9000 }),
    op({ id: 'o4', workspace_id: 'autre', origin_interaction_id: null, amount: 100 }),
  ],
};

const today = '2026-10-07';

describe('computeMetrics', () => {
  it('exclut la rencontre annulée', () => {
    const m = computeMetrics(cache, { day: 'all', scope: 'team', me: A, today });
    expect(m.meetings).toBe(6);
    expect(m.ids.all).not.toContain('4');
  });

  it('compte les personnes distinctes', () => {
    expect(computeMetrics(cache, { day: 'all', scope: 'team', me: A, today }).people).toBe(5);
  });

  it('range 23 h 30 heure de Paris dans le bon jour', () => {
    const d1 = computeMetrics(cache, { day: '2026-10-06', scope: 'team', me: A, today });
    const d2 = computeMetrics(cache, { day: '2026-10-07', scope: 'team', me: A, today });
    expect(d1.ids.all).toContain('5');
    expect(d2.ids.all).not.toContain('5');
    expect(d1.meetings).toBe(4);
    expect(d2.meetings).toBe(2);
  });

  it('exclut les clients de la répartition du potentiel', () => {
    const m = computeMetrics(cache, { day: 'all', scope: 'team', me: A, today });
    expect(m.hot).toBe(2);
    expect(m.potential).toEqual({ hot: 1, good: 1, explore: 1, none: 1 });
    expect(m.customers).toBe(1);
    expect(m.partners).toBe(1);
    expect(m.newProspects).toBe(4);
  });

  it('exclut les projets abandonnés et ceux des autres salons', () => {
    const m = computeMetrics(cache, { day: 'all', scope: 'team', me: A, today });
    expect(m.projects).toBe(2);
    expect(m.projectsAmount).toBe(5000);
    expect(m.projectsWithoutAmount).toBe(1);
  });

  it('détecte les actions en retard et faites', () => {
    const m = computeMetrics(cache, { day: 'all', scope: 'team', me: A, today });
    expect(m.actionsTodo).toBe(1);
    expect(m.actionsOverdue).toBe(1);
    expect(m.actionsDone).toBe(1);
  });

  it('filtre par périmètre et fait suivre les projets', () => {
    const mine = computeMetrics(cache, { day: 'all', scope: 'mine', me: A, today });
    expect(mine.meetings).toBe(3);
    expect(mine.projects).toBe(1);
    const b = computeMetrics(cache, { day: 'all', scope: { userId: B }, me: A, today });
    expect(b.meetings).toBe(3);
    expect(b.projects).toBe(1);
  });

  it('calcule la rentabilité', () => {
    const m = computeMetrics(cache, { day: 'all', scope: 'team', me: A, today });
    expect(m.costPerMeeting).toBeCloseTo(1000 / 6);
    expect(m.costPerProject).toBe(500);
    const noCost = computeMetrics({ ...cache, workspace: { ...cache.workspace, total_cost: null } }, { day: 'all', scope: 'team', me: A, today });
    expect(noCost.costPerMeeting).toBeNull();
  });

  it('ventile par membre et par jour ou heure', () => {
    const m = computeMetrics(cache, { day: 'all', scope: 'team', me: A, today });
    const a = m.byMember.find((r) => r.userId === A)!;
    const b = m.byMember.find((r) => r.userId === B)!;
    expect(a).toMatchObject({ meetings: 3, hot: 1, projects: 1, overdue: 1 });
    expect(b).toMatchObject({ meetings: 3, hot: 1, projects: 1, overdue: 0 });
    expect(m.series.map((s) => s.count)).toEqual([4, 2]);
    const d1 = computeMetrics(cache, { day: '2026-10-06', scope: 'team', me: A, today });
    expect(d1.seriesMode).toBe('hour');
    expect(d1.series.find((s) => s.key === '23')?.count).toBe(1);
  });
});
