import { revealDelay } from '../reveal';

describe('Reveal delay', () => {
  it('appliqué à l\'apparition', () => {
    expect(revealDelay(true, false, 150)).toBe('150ms');
    expect(revealDelay(false, false, 150)).toBe('0ms');
  });
  it('aucun délai si reduced motion', () => {
    expect(revealDelay(true, true, 150)).toBe('0ms');
  });
  it('défaut 0', () => expect(revealDelay(true, false)).toBe('0ms'));
});
