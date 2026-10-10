import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Reveal } from '../reveal';

function setup(reduced: boolean) {
  (window as any).matchMedia = (q: string) => ({ matches: reduced && q.includes('reduce'), addEventListener() {}, removeEventListener() {} });
  (window as any).IntersectionObserver = class {
    cb: any; constructor(cb: any) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: true }]); }
    disconnect() {}
  };
}

async function render() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => { createRoot(el).render(<Reveal delay={150}>x</Reveal>); });
  return el.firstElementChild as HTMLElement;
}

describe('Reveal delay', () => {
  it('applique le délai à l\'apparition', async () => {
    setup(false);
    expect((await render()).style.transitionDelay).toBe('150ms');
  });
  it('aucun délai si reduced motion', async () => {
    setup(true);
    expect((await render()).style.transitionDelay).toBe('0ms');
  });
});
