import { renderToStaticMarkup } from 'react-dom/server';
import { joinBeta, AUTH_RETURN } from '../joinBeta';
import LeadsPricingCards from '../LeadsPricingCards';
import { LEADS_PLANS, LEADS_FEATURES } from '@/config/leadsPlans';

describe('joinBeta', () => {
  it('non connecté', () => {
    expect(joinBeta({ loggedIn: false, hasLeadsAccess: false, exhibitorSlugs: [] })).toEqual({ kind: 'auth', to: AUTH_RETURN });
    expect(AUTH_RETURN).toBe('/auth?redirect=/lotexpo-leads%23beta');
  });
  it('une fiche', () => {
    expect(joinBeta({ loggedIn: true, hasLeadsAccess: false, exhibitorSlugs: ['acme'] })).toEqual({ kind: 'manage', to: '/exposants/acme/gerer?section=leads' });
  });
  it('plusieurs fiches', () => {
    expect(joinBeta({ loggedIn: true, hasLeadsAccess: false, exhibitorSlugs: ['a', 'b'] })).toEqual({ kind: 'choose' });
  });
  it('aucune fiche', () => {
    expect(joinBeta({ loggedIn: true, hasLeadsAccess: false, exhibitorSlugs: [] })).toEqual({ kind: 'claim' });
  });
  it('accès déjà ouvert', () => {
    expect(joinBeta({ loggedIn: true, hasLeadsAccess: true, exhibitorSlugs: ['a', 'b'] })).toEqual({ kind: 'open', to: '/leads' });
  });
});

describe('tarifs', () => {
  it('affiche les prix de leadsPlans.ts', () => {
    const html = renderToStaticMarkup(<LeadsPricingCards />);
    for (const p of LEADS_PLANS) {
      expect(html).toContain(p.price);
      expect(html).toContain(p.name);
      if (p.priceUnit) expect(html).toContain(p.priceUnit);
    }
  });
});

describe('matrice des tarifs', () => {
  const html = renderToStaticMarkup(<LeadsPricingCards />);
  const cards = html.split('data-plan="').slice(1);
  const expectedExcluded: Record<string, number> = { free: 8, salon: 3, annual: 0 };
  for (const p of LEADS_PLANS) {
    it(`plan ${p.id}`, () => {
      const card = cards.find((c) => c.startsWith(`${p.id}"`))!;
      const ids = Array.from(card.matchAll(/data-feature="([^"]+)"/g)).map((m) => m[1]);
      expect(ids).toEqual(LEADS_FEATURES.map((f) => f.id));
      expect((card.match(/data-excluded/g) ?? []).length).toBe(expectedExcluded[p.id]);
      expect(card).toContain(p.id === 'free' ? '1 seul utilisateur' : 'Jusqu&#x27;à 15 utilisateurs');
      expect(Object.keys(p.includes).sort()).toEqual(LEADS_FEATURES.map((f) => f.id).sort());
    });
  }
});
