import { renderToStaticMarkup } from 'react-dom/server';
import { BoothPlanPickerView } from '../BoothPlanPicker';
import { readPaymentReturn, runCheckout, startPaymentPolling, vatMention } from '../billing';
import { LEADS_PLANS, LEADS_PLANS_NOTE } from '@/config/leadsPlans';
import type { BoothBillingOverview } from '@/lib/booth/rpc';

jest.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const ov: BoothBillingOverview = {
  livemode: false, vat_mode: 'franchise', currency: 'eur',
  pass_amount_cents: 31000, annual_amount_cents: 155000, pass_grace_days: 45, payments: [],
};
const ev = [{ id: 'e1', name: 'SEPEM' }];

describe('BoothPlanPicker', () => {
  it('prix lus depuis la vue de facturation et mention franchise', () => {
    const h = renderToStaticMarkup(<BoothPlanPickerView overview={ov} upcoming={ev} onPay={async () => {}} />);
    expect(h).toContain('310 €');
    expect(h).toContain('1 550 €');
    expect(h).not.toContain('290 €');
    expect(h).toContain('TVA non applicable, art. 293 B du CGI');
    expect(h).toContain('45 jours');
    expect(h).toContain('Mode test');
  });
  it('bouton Pass désactivé sans salon choisi', () => {
    const h = renderToStaticMarkup(<BoothPlanPickerView overview={ov} upcoming={ev} onPay={async () => {}} />);
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*data-plan="pass"/);
    const h2 = renderToStaticMarkup(<BoothPlanPickerView overview={ov} upcoming={ev} initialEventId="e1" onPay={async () => {}} />);
    expect(h2).not.toMatch(/<button[^>]*disabled=""[^>]*data-plan="pass"/);
  });
  it('message BOOTH_EVENT_PAST affiché', () => {
    const h = renderToStaticMarkup(<BoothPlanPickerView overview={ov} upcoming={ev} initialError="BOOTH_EVENT_PAST" />);
    expect(h).toContain('Ce salon est terminé : choisissez un salon à venir.');
  });
  it('mention TVA', () => {
    expect(vatMention('vat')).toContain('Prix HT, TVA 20 %');
  });
  it('startCheckout appelé avec (pass, eventId) puis (annual, null)', async () => {
    const calls: unknown[] = [];
    const urls: string[] = [];
    const start = async (p: 'pass' | 'annual', e: string | null) => { calls.push([p, e]); return { url: 'u-' + p }; };
    await runCheckout(start, 'pass', 'e1', (u) => urls.push(u));
    await runCheckout(start, 'annual', 'e1', (u) => urls.push(u));
    expect(calls).toEqual([['pass', 'e1'], ['annual', null]]);
    expect(urls).toEqual(['u-pass', 'u-annual']);
  });
});

describe('retour de paiement', () => {
  it('paramètres retirés de l’URL', () => {
    expect(readPaymentReturn('?section=leads&paiement=ok&session_id=cs_1')).toEqual({ ret: 'ok', cleaned: '?section=leads' });
    expect(readPaymentReturn('?paiement=annule').ret).toBe('annule');
  });
  it('sondage arrêté dès que l’accès est ouvert', async () => {
    const queue: (() => void)[] = [];
    const timers = { set: ((f: () => void) => { queue.push(f); return 1; }) as unknown as typeof setTimeout, clear: (() => {}) as typeof clearTimeout };
    let n = 0;
    const results: string[] = [];
    startPaymentPolling(async () => ++n >= 2, (r) => results.push(r), timers, () => 0);
    await Promise.resolve(); await Promise.resolve();
    expect(queue.length).toBe(1);
    queue.shift()!();
    await Promise.resolve(); await Promise.resolve();
    expect(results).toEqual(['opened']);
    expect(n).toBe(2);
    expect(queue.length).toBe(0);
  });
});

describe('leadsPlans', () => {
  it('aucun « HT »', () => {
    const txt = JSON.stringify(LEADS_PLANS) + LEADS_PLANS_NOTE;
    expect(txt).not.toMatch(/\bHT\b/);
  });
});

describe('Lot P2', () => {
  const { OnboardingCard } = require('../BoothPaymentReturn');
  const { openCheckoutUrl } = require('../billing');
  it('prix publics à jour', () => {
    const prices = LEADS_PLANS.map((p) => p.price).join(' ');
    expect(prices).toContain('190 €');
    expect(prices).toContain('570 €');
    for (const old of ['290', '1 490', '1490', '720']) expect(prices).not.toContain(old);
  });
  it('carte Annuel : prix de 3 Pass', () => {
    const h = renderToStaticMarkup(<BoothPlanPickerView overview={ov} upcoming={ev} />);
    expect(h).toContain('Le prix de 3 Pass salon, pour tous vos salons de');
  });
  it('carte de prise en main avec lien, rien sans', () => {
    const h = renderToStaticMarkup(<OnboardingCard url="https://cal.com/x" />);
    expect(h).toContain('30 minutes pour bien démarrer');
    expect(h).toContain('target="_blank"');
    expect(h).toContain('noopener');
    expect(renderToStaticMarkup(<OnboardingCard url={null} />)).toBe('');
    expect(renderToStaticMarkup(<OnboardingCard url="" />)).toBe('');
  });
  it('paiement dans un cadre : nouvel onglet', () => {
    const assigned: string[] = [];
    const top = {};
    const w = { self: {}, top, open: () => null, location: { assign: (u: string) => assigned.push(u) } };
    expect(openCheckoutUrl('u', w as never)).toBe(false);
    const w2 = { ...w, self: top };
    expect(openCheckoutUrl('u', w2 as never)).toBe(true);
    expect(assigned).toEqual(['u']);
  });
  it('type de notification booth_payment_paid reconnu', () => {
    const src = require('fs').readFileSync('src/components/notifications/NotificationCard.tsx', 'utf8');
    expect(src).toContain("'booth_payment_paid': '💶'");
  });
});

describe('Lot P2b : salons du Pass', () => {
  const { mergePlanEvents, addSearchedEvent } = require('../BoothPlanPicker');
  const today = '2026-10-10';
  const w = (id: string, o: Record<string, unknown> = {}) => ({ event_id: id, nom_event: id, date_debut: '2026-11-01', date_fin: '2026-11-03', archived: false, ...o });
  it('salon présent seulement dans les espaces : listé et présélectionné', () => {
    const r = mergePlanEvents([], [w('sepem')], today);
    expect(r.events.map((e: { id: string }) => e.id)).toEqual(['sepem']);
    expect(r.preselect).toBe('sepem');
    const h = renderToStaticMarkup(<BoothPlanPickerView overview={ov} upcoming={r.events} initialEventId={r.preselect} onPay={async () => {}} />);
    expect(h).not.toMatch(/<button[^>]*disabled=""[^>]*data-plan="pass"/);
    expect(h).toContain('Choisissez le salon couvert par ce Pass');
    expect(h).toContain('Mon salon n&#x27;est pas dans la liste');
  });
  it('archivé ou passé exclu', () => {
    const r = mergePlanEvents([], [w('a', { archived: true }), w('p', { date_debut: '2026-09-01', date_fin: '2026-09-03' })], today);
    expect(r.events).toEqual([]);
    expect(r.preselect).toBeNull();
  });
  it('pas de doublon, tri par date', () => {
    const r = mergePlanEvents([{ id: 'x', name: 'X', date_debut: '2026-12-01' }, { id: 'sepem', name: 'SEPEM', date_debut: '2026-11-01' }], [w('sepem')], today);
    expect(r.events.map((e: { id: string }) => e.id)).toEqual(['sepem', 'x']);
  });
  it('salon trouvé par la recherche ajouté et sélectionné', () => {
    const r = addSearchedEvent([{ id: 'x', name: 'X' }], { id: 'n', name: 'N' });
    expect(r.selected).toBe('n');
    expect(r.events.map((e: { id: string }) => e.id)).toContain('n');
    expect(addSearchedEvent(r.events, { id: 'n', name: 'N' }).events.length).toBe(2);
  });
});
