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
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const expectedExcluded: Record<string, number> = { free: 8, salon: 3, annual: 0 };
  for (const p of LEADS_PLANS) {
    it(`plan ${p.id}`, () => {
      const card = doc.querySelector(`[data-plan="${p.id}"]`)!;
      const ids = Array.from(card.querySelectorAll('[data-feature]')).map((li) => li.getAttribute('data-feature'));
      expect(ids).toEqual(LEADS_FEATURES.map((f) => f.id));
      expect(card.querySelectorAll('[data-excluded]').length).toBe(expectedExcluded[p.id]);
      expect(card.textContent).toContain(p.id === 'free' ? '1 seul utilisateur' : "Jusqu'à 15 utilisateurs");
      for (const f of LEADS_FEATURES) expect(typeof p.includes[f.id]).toBe('boolean');
      expect(Object.keys(p.includes).sort()).toEqual(LEADS_FEATURES.map((f) => f.id).sort());
    });
  }
});
