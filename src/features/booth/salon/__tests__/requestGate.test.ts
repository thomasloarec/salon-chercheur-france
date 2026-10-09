import { describe, expect, it } from 'bun:test';
import { createRequestGate } from '../requestGate';

describe('createRequestGate', () => {
  it("ignore un résultat de dictée arrivé après « Annuler »", async () => {
    const gate = createRequestGate();
    let fiche = { name: 'Saisie manuelle' };
    const token = gate.next();
    const pending = new Promise<{ name: string }>((r) => setTimeout(() => r({ name: 'Dictée' }), 5));
    gate.cancel();
    const res = await pending;
    if (gate.isCurrent(token)) fiche = res;
    expect(fiche.name).toBe('Saisie manuelle');
  });
  it('applique le résultat sans annulation', () => {
    const gate = createRequestGate();
    const t = gate.next();
    expect(gate.isCurrent(t)).toBe(true);
    gate.next();
    expect(gate.isCurrent(t)).toBe(false);
  });
});
