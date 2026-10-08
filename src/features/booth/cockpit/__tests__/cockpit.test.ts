import { buildCockpit, type CockpitUpcoming } from '../cockpit';
import type { BoothWorkspace, BoothWorkspaceSummaryItem } from '@/lib/booth/rpc';

const ws = (id: string, phase: BoothWorkspace['phase'], d1: string, d2: string, extra: Partial<BoothWorkspace> = {}): BoothWorkspace => ({
  workspace_id: `w-${id}`,
  event_id: `e-${id}`,
  nom_event: `Salon ${id}`,
  event_slug: null,
  ville: null,
  date_debut: d1,
  date_fin: d2,
  stand_label: null,
  timezone: null,
  currency: null,
  total_cost: null,
  archived: false,
  phase,
  full_features: true,
  interactions_count: 0,
  ...extra,
});

const sum = (id: string, actions_open: number): BoothWorkspaceSummaryItem => ({
  workspace_id: `w-${id}`,
  nom_event: '',
  ville: null,
  date_debut: null,
  date_fin: null,
  currency: null,
  total_cost: null,
  archived: false,
  phase: 'after',
  meetings: 0,
  people: 0,
  new_prospects: 0,
  hot: 0,
  customers: 0,
  actions_open,
  actions_done: 0,
  actions_overdue: 0,
  projects: 0,
  projects_amount: null,
  projects_without_amount: 0,
  weighted_amount: null,
  won: 0,
  won_amount: null,
  lost: 0,
});

const up = (id: string, d: string): CockpitUpcoming => ({
  event: { id: `e-${id}`, nom_event: `Salon ${id}`, slug: null, ville: null, date_debut: d, date_fin: d },
});

const today = '2026-10-08';

describe('buildCockpit', () => {
  it('ordonne pendant, après à faire, avant, à préparer, après terminés', () => {
    const cards = buildCockpit({
      workspaces: [
        ws('done', 'after', '2026-09-01', '2026-09-03'),
        ws('before', 'before', '2026-11-01', '2026-11-02'),
        ws('after', 'after', '2026-09-20', '2026-09-22'),
        ws('during', 'during', '2026-10-07', '2026-10-09'),
        ws('arch', 'before', '2026-11-01', '2026-11-02', { archived: true }),
      ],
      upcoming: [up('prep', '2026-12-01')],
      summary: [sum('done', 0), sum('after', 3)],
      today,
    });
    expect(cards.map((c) => c.kind)).toEqual(['during', 'after', 'before', 'prepare', 'after']);
    expect(cards[1].done).toBe(false);
    expect(cards[1].daysSince).toBe(16);
    expect(cards[4].done).toBe(true);
    expect(cards[2].daysUntil).toBe(24);
  });

  it('Jour 2 sur 3', () => {
    const [c] = buildCockpit({ workspaces: [ws('d', 'during', '2026-10-07', '2026-10-09')], upcoming: [], summary: null, today });
    expect(c.dayIndex).toBe(2);
    expect(c.dayCount).toBe(3);
  });

  it("pas de carte à préparer en double si l'espace existe", () => {
    const cards = buildCockpit({ workspaces: [ws('a', 'before', '2026-11-01', '2026-11-01')], upcoming: [up('a', '2026-11-01')], summary: null, today });
    expect(cards.length).toBe(1);
    expect(cards[0].kind).toBe('before');
  });

  it("phase unknown traitée comme avant", () => {
    const [c] = buildCockpit({ workspaces: [ws('u', 'unknown', '2026-10-10', '2026-10-11')], upcoming: [], summary: null, today });
    expect(c.kind).toBe('before');
    expect(c.daysUntil).toBe(2);
  });

  it('au plus 5 cartes à préparer, les plus proches', () => {
    const upcoming = ['7', '3', '5', '1', '6', '2', '4'].map((n) => up(n, `2026-11-0${n}`));
    const cards = buildCockpit({ workspaces: [], upcoming, summary: null, today });
    expect(cards.length).toBe(5);
    expect(cards.map((c) => c.event.id)).toEqual(['e-1', 'e-2', 'e-3', 'e-4', 'e-5']);
  });
});
