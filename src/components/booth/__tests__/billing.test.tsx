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
