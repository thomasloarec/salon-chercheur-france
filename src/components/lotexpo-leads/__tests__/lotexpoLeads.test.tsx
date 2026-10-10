import { renderToStaticMarkup } from 'react-dom/server';
import { joinBeta, AUTH_RETURN } from '../joinBeta';
import LeadsPricingCards from '../LeadsPricingCards';
import { LEADS_PLANS } from '@/config/leadsPlans';

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
