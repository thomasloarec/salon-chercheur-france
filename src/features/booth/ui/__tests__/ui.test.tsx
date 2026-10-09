import { renderToStaticMarkup } from 'react-dom/server';
import ChoiceCard from '../ChoiceCard';
import PotentialBadge from '../PotentialBadge';
import { haptic } from '../motion';

describe('ChoiceCard', () => {
  it('affiche la lettre et garde data-choice', () => {
    const html = renderToStaticMarkup(<ChoiceCard index={2}>Partenaire</ChoiceCard>);
    expect(html).toContain('data-choice=""');
    expect(html).toContain('>C</span>');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('font-bold');
  });
  it('marque l’état choisi avec la couleur du ton', () => {
    const html = renderToStaticMarkup(<ChoiceCard index={0} selected tone="flame">Chaud</ChoiceCard>);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('>A</span>');
    expect(html).toContain('bg-flame-surface');
    expect(html).toContain('font-extrabold');
  });
});

describe('PotentialBadge', () => {
  const cases = [
    ['hot', 'Chaud', 'bg-flame-soft'],
    ['good', 'Intéressant', 'bg-violet-soft'],
    ['explore', 'À creuser', 'bg-info-surface'],
    ['none', 'Pas de potentiel', 'bg-muted'],
  ] as const;
  for (const [v, label, cls] of cases) {
    it(`rend ${label}`, () => {
      const html = renderToStaticMarkup(<PotentialBadge value={v} />);
      expect(html).toContain(label);
      expect(html).toContain(cls);
      expect(html).toContain('<svg');
    });
  }
});

describe('haptic', () => {
  it('ne fait rien sans navigator.vibrate', () => {
    const nav = globalThis.navigator as unknown as Record<string, unknown> | undefined;
    const saved = nav?.vibrate;
    if (nav) delete nav.vibrate;
    expect(() => haptic(20)).not.toThrow();
    if (nav && saved) nav.vibrate = saved;
  });
  it('appelle navigator.vibrate quand il existe', () => {
    const calls: unknown[] = [];
    const g = globalThis as unknown as { navigator?: Record<string, unknown> };
    const had = 'navigator' in g;
    const prev = g.navigator;
    Object.defineProperty(g, 'navigator', { value: { vibrate: (p: unknown) => calls.push(p) }, configurable: true });
    haptic(15);
    expect(calls).toEqual([15]);
    if (had) Object.defineProperty(g, 'navigator', { value: prev, configurable: true });
    else delete g.navigator;
  });
});
