import { CAMERA_PENDING, initialWho, openCardCamera } from '../directStart';

describe('tuile Carte', () => {
  it('note la prise de vue puis clique le champ photo de façon synchrone', () => {
    const order: string[] = [];
    const store = new Map<string, string>();
    const st = { setItem: (k: string, v: string) => { order.push('store'); store.set(k, v); } };
    const input = { click: () => order.push('click') };
    const ret = openCardCamera(input, 'w1', st, 1000);
    // Le clic a eu lieu avant le retour de la fonction : aucune attente.
    expect(ret).toBe(true);
    expect(order).toEqual(['store', 'click']);
    expect(JSON.parse(store.get(CAMERA_PENDING)!)).toEqual({ workspaceId: 'w1', kind: 'card', at: 1000 });
  });
  it('photo reçue : lecture de la carte, sans choix carte ou badge', () => {
    const w = initialWho({ startMode: 'card', hasPhoto: true, voiceOk: true });
    expect(w.readPhoto).toBe(true);
    expect(w.kindPicker).toBe(false);
    expect(w.dictateOnly).toBe(false);
  });
});

describe('tuile Dicter', () => {
  it('enregistrement seul, sans focus sur le Nom', () => {
    const w = initialWho({ startMode: 'dictate', hasPhoto: false, voiceOk: true });
    expect(w.dictateOnly).toBe(true);
    expect(w.nameAutoFocus).toBe(false);
  });
  it('sans dictée possible : étape Qui normale, toujours sans focus', () => {
    const w = initialWho({ startMode: 'dictate', hasPhoto: false, voiceOk: false });
    expect(w.dictateOnly).toBe(false);
    expect(w.nameAutoFocus).toBe(false);
  });
  it('ouverture normale : focus sur le Nom', () => {
    expect(initialWho({ startMode: null, hasPhoto: false, voiceOk: true }).nameAutoFocus).toBe(true);
  });
});
