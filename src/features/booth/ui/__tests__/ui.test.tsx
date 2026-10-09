import { renderToStaticMarkup } from 'react-dom/server';
import { Phone } from 'lucide-react';
import ChoiceCard from '../ChoiceCard';
import PotentialBadge from '../PotentialBadge';
import { ConfettiView } from '../Confetti';
import { haptic } from '../motion';

describe('ChoiceCard', () => {
  it('lettre visible seulement à partir de lg', () => {
    const html = renderToStaticMarkup(<ChoiceCard index={2} icon={Phone}>Rappeler</ChoiceCard>);
    expect(html).toContain('data-choice=""');
    expect(html).toMatch(/data-letter=""[^>]*class="hidden [^"]*lg:flex/);
    expect(html).toContain('>C</span>');
    expect(html).not.toContain('font-bold');
    expect(html).not.toContain('border-2');
  });
  it('sans icône : la pastille porte la lettre', () => {
    const html = renderToStaticMarkup(<ChoiceCard index={0}>Oui</ChoiceCard>);
    expect(html).toMatch(/data-pill=""[^>]*>A<\/span>/);
    expect(html).not.toContain('data-letter');
  });
  it('coche quand choisi, à la place de la lettre, pastille du ton', () => {
    const html = renderToStaticMarkup(<ChoiceCard index={0} selected tone="flame" icon={Phone}>Chaud</ChoiceCard>);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-check=""');
    expect(html).not.toContain('data-letter');
    expect(html).toContain('bg-flame');
    expect(html).toContain('bg-booth-choice');
    expect(html).toContain('font-semibold');
  });
  it('libellé long sur plusieurs lignes, jamais sous l’icône', () => {
    const html = renderToStaticMarkup(
      <ChoiceCard index={1} icon={Phone}>Envoyer une documentation complète et détaillée</ChoiceCard>,
    );
    expect(html).toMatch(/data-label=""[^>]*class="[^"]*min-w-0[^"]*flex-1[^"]*break-words/);
    expect(html).not.toContain('flex-wrap');
    expect(html).not.toContain('flex-col');
  });
});

describe('PotentialBadge', () => {
  const cases = [
    ['hot', 'Chaud', 'bg-booth-hot-bg'],
    ['good', 'Intéressant', 'bg-booth-good-bg'],
    ['explore', 'À creuser', 'bg-booth-explore-bg'],
    ['none', 'Pas de potentiel', 'bg-booth-pill'],
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

describe('Confetti', () => {
  it('rien en mouvement réduit', () => {
    expect(renderToStaticMarkup(<ConfettiView count={14} calm />)).toBe('');
  });
  it('14 pièces sinon', () => {
    const html = renderToStaticMarkup(<ConfettiView count={14} calm={false} />);
    expect(html).toContain('pointer-events-none');
    expect((html.match(/<span/g) ?? []).length).toBe(14);
  });
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
