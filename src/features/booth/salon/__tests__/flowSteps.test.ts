import { stepCounter } from '../flowSteps';
import { addSaved, dayStats, goalJustReached } from '../savedStats';
import type { Interaction } from '@/lib/booth/types';

const base = { relationship: null, potential: null, customer_topic: null } as const;

describe('stepCounter', () => {
  it('prospect : 7 étapes (qui, coordonnées, relation, potentiel, projet, action, détails)', () => {
    expect(stepCounter({ ...base, step: 'who', history: [] })).toEqual({ index: 1, total: 7 });
    expect(stepCounter({ ...base, relationship: 'new_prospect', potential: 'hot', step: 'action', history: ['who', 'coord', 'rel', 'pot', 'concrete'] })).toEqual({ index: 6, total: 7 });
  });
  it('sans potentiel : s’arrête à Potentiel', () => {
    expect(stepCounter({ ...base, relationship: 'new_prospect', potential: 'none', step: 'pot', history: ['who', 'coord', 'rel'] })).toEqual({ index: 4, total: 4 });
  });
  it('client sans nouveau projet : pas d’étape Projet', () => {
    expect(stepCounter({ ...base, relationship: 'customer', customer_topic: 'relationship', step: 'topic', history: ['who', 'rel'] })).toEqual({ index: 3, total: 5 });
  });
  it('client avec nouveau projet', () => {
    expect(stepCounter({ ...base, relationship: 'customer', customer_topic: 'new_project', step: 'topic', history: ['who', 'coord', 'rel'] })).toEqual({ index: 4, total: 7 });
  });
});

describe('objectif du jour', () => {
  it('atteint seulement au franchissement', () => {
    expect(goalJustReached(11, 12, 12)).toBe(true);
    expect(goalJustReached(12, 13, 12)).toBe(false);
    expect(goalJustReached(5, 6, 12)).toBe(false);
    expect(goalJustReached(0, 1, null)).toBe(false);
  });
  it('compte du jour sans la rencontre enregistrée', () => {
    const now = new Date();
    const mk = (id: string, owner: string, potential: Interaction['potential'] = null) =>
      ({ id, workspace_id: 'w', owner_user_id: owner, occurred_at: now.toISOString(), potential, status: 'completed' }) as unknown as Interaction;
    const list = [mk('a', 'me', 'hot'), mk('b', 'x'), mk('c', 'me')];
    const before = dayStats(list, 'w', 'me', 'c', now);
    expect(before).toEqual({ mine: 1, hot: 1, team: 2 });
    expect(addSaved(before, 'hot')).toEqual({ mine: 2, hot: 2, team: 3 });
  });
});
