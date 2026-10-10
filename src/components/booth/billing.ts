import type { BoothAccess, BoothBillingOverview, BoothCheckoutPlan } from '@/lib/booth/rpc';

export const formatCents = (cents: number, currency = 'eur') =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })
    .format(cents / 100)
    .replace(/\u202f|\u00a0/g, ' ');

export const vatMention = (mode: BoothBillingOverview['vat_mode']) =>
  mode === 'franchise'
    ? 'TVA non applicable, art. 293 B du CGI. Facture envoyée par email.'
    : 'Prix HT, TVA 20 % en sus. Facture envoyée par email.';

/** Arguments envoyés au serveur : le Pass porte un salon, l'Annuel jamais. */
export const checkoutArgs = (plan: BoothCheckoutPlan, eventId: string | null) =>
  ({ plan, eventId: plan === 'pass' ? eventId : null }) as const;

export async function runCheckout(
  start: (plan: BoothCheckoutPlan, eventId: string | null) => Promise<{ url: string }>,
  plan: BoothCheckoutPlan,
  eventId: string | null,
  assign: (url: string) => void,
) {
  const a = checkoutArgs(plan, eventId);
  const { url } = await start(a.plan, a.eventId);
  assign(url);
}

/** Dans un cadre (aperçu), Stripe s'ouvre dans un nouvel onglet. Renvoie false si le navigateur a bloqué l'onglet. */
export function openCheckoutUrl(
  url: string,
  w: Pick<Window, 'self' | 'top' | 'open'> & { location: Pick<Location, 'assign'> },
): boolean {
  let framed = true;
  try {
    framed = w.self !== w.top;
  } catch {
    framed = true;
  }
  if (!framed) {
    w.location.assign(url);
    return true;
  }
  return w.open(url, '_blank', 'noopener') !== null;
}

/** Accès ouvert après paiement : payé et formule payante. */
export const accessOpened = (a: Pick<BoothAccess, 'is_paid' | 'plan'> | null | undefined) =>
  !!a && a.is_paid && (a.plan === 'pass' || a.plan === 'annual');

export type PaymentReturn = 'ok' | 'annule' | null;

/** Lit le retour Stripe et renvoie la recherche nettoyée (sans paiement ni session_id). */
export function readPaymentReturn(search: string): { ret: PaymentReturn; cleaned: string } {
  const p = new URLSearchParams(search);
  const v = p.get('paiement');
  const ret: PaymentReturn = v === 'ok' ? 'ok' : v === 'annule' ? 'annule' : null;
  p.delete('paiement');
  p.delete('session_id');
  const s = p.toString();
  return { ret, cleaned: s ? `?${s}` : '' };
}

export const POLL_INTERVAL_MS = 2000;
export const POLL_MAX_MS = 30000;

/**
 * Sonde jusqu'à l'ouverture de l'accès ou 30 s. Renvoie une fonction d'arrêt.
 * `check` rafraîchit les données et dit si l'accès est ouvert.
 */
export function startPaymentPolling(
  check: () => Promise<boolean>,
  onDone: (result: 'opened' | 'timeout') => void,
  timers: { set: typeof setTimeout; clear: typeof clearTimeout } = { set: setTimeout, clear: clearTimeout },
  now: () => number = Date.now,
) {
  const started = now();
  let stopped = false;
  let handle: ReturnType<typeof setTimeout> | null = null;
  const tick = async () => {
    if (stopped) return;
    let ok = false;
    try {
      ok = await check();
    } catch {
      ok = false;
    }
    if (stopped) return;
    if (ok) {
      stopped = true;
      onDone('opened');
      return;
    }
    if (now() - started >= POLL_MAX_MS) {
      stopped = true;
      onDone('timeout');
      return;
    }
    handle = timers.set(tick, POLL_INTERVAL_MS);
  };
  void tick();
  return () => {
    stopped = true;
    if (handle) timers.clear(handle);
  };
}

/** Annuel se terminant dans moins de 60 jours. */
export function annualEndingSoon(validUntil: string | null, today = new Date()) {
  if (!validUntil) return false;
  const end = new Date(validUntil).getTime();
  return end - today.getTime() < 60 * 86400000;
}
