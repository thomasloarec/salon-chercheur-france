// booth-stripe-webhook
//
// Lotexpo Leads : reçoit les événements Stripe (verify_jwt = false, la sécurité est la signature Stripe).
//
//   checkout.session.completed (payée)       -> _booth_payment_settle : paiement « paid », accès ouvert
//   checkout.session.async_payment_succeeded -> idem (paiements différés, ex. prélèvement SEPA)
//   checkout.session.expired / async_payment_failed -> paiement « expired »
//   charge.refunded                          -> paiement « refunded » (l'accès n'est pas coupé), email à l'admin
//
// Seules les sessions créées par booth-checkout (metadata.source = lotexpo_leads) sont traitées.
// Rejouer un événement est sans effet : la base ignore un paiement déjà réglé.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { stripeRequest, verifyStripeSignature } from '../_shared/stripe.ts';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph, dataTable, infoBox } from '../_shared/email-template.ts';

const LOG = '[booth-stripe-webhook]';
const ADMIN_EMAIL = 'admin@lotexpo.com';
const SITE_URL = 'https://lotexpo.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function euros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
function dateFr(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
}

type Session = {
  id: string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  customer: string | null;
  payment_intent: string | null;
  invoice: string | null;
  metadata: Record<string, string> | null;
  customer_details?: { business_name?: string | null; name?: string | null } | null;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const raw = await req.text();
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  if (!(await verifyStripeSignature(raw, req.headers.get('Stripe-Signature'), secret))) {
    console.warn(LOG, 'signature invalide ou absente');
    return json({ error: 'invalid_signature' }, 400);
  }

  let event: { id: string; type: string; livemode: boolean; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as unknown as Session;
        if (s.metadata?.source !== 'lotexpo_leads' || !UUID_RE.test(s.metadata?.payment_id ?? '')) return json({ ok: true, skipped: 'not_leads' });
        if (s.payment_status !== 'paid') return json({ ok: true, skipped: 'not_paid_yet' });
        return await settle(db, s);
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as unknown as Session;
        if (s.metadata?.source !== 'lotexpo_leads') return json({ ok: true, skipped: 'not_leads' });
        const { error } = await db.rpc('_booth_payment_expire', { p_session_id: s.id });
        if (error) throw new Error(error.message);
        return json({ ok: true, expired: true });
      }
      case 'charge.refunded': {
        const pi = (event.data.object as { payment_intent?: string | null }).payment_intent;
        if (!pi) return json({ ok: true, skipped: 'no_payment_intent' });
        const { data, error } = await db.rpc('_booth_payment_refunded', { p_payment_intent: pi });
        if (error) throw new Error(error.message);
        if (data?.payment_id) await notifyAdminRefund(db, data.exhibitor_id);
        return json({ ok: true, refunded: Boolean(data?.payment_id) });
      }
      default:
        return json({ ok: true, skipped: event.type });
    }
  } catch (err) {
    // 500 : Stripe renverra l'événement plus tard
    console.error(LOG, 'traitement en échec', event.type, String(err));
    return json({ ok: false }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function settle(db: any, s: Session) {
  // Facture créée par Checkout : lien public et PDF
  let invoiceUrl: string | null = null;
  let invoicePdf: string | null = null;
  if (s.invoice) {
    try {
      const inv = await stripeRequest<{ hosted_invoice_url?: string; invoice_pdf?: string }>('GET', `/invoices/${s.invoice}`);
      invoiceUrl = inv.hosted_invoice_url ?? null;
      invoicePdf = inv.invoice_pdf ?? null;
    } catch (err) {
      console.warn(LOG, 'facture non lue', String(err));
    }
  }

  const { data: r, error } = await db.rpc('_booth_payment_settle', {
    p_session_id: s.id,
    p_payment_intent: s.payment_intent,
    p_amount_total: s.amount_total,
    p_currency: s.currency,
    p_customer_id: s.customer,
    p_invoice_id: s.invoice,
    p_invoice_url: invoiceUrl,
    p_invoice_pdf: invoicePdf,
  });
  if (error) {
    if (error.message?.includes('BOOTH_NOT_FOUND')) return json({ ok: true, skipped: 'unknown_session' });
    throw new Error(error.message);
  }

  if (r?.result === 'mismatch') {
    console.error(LOG, 'montant reçu différent du montant attendu', { payment: r.payment_id });
    await safeSend({
      to: ADMIN_EMAIL,
      subject: '⚠️ Lotexpo Leads : paiement à vérifier',
      html: renderEmailShell({
        title: 'Paiement à vérifier',
        preheader: 'Le montant reçu ne correspond pas au montant attendu.',
        bodyBlocks: [heading('Paiement à vérifier'), paragraph(`Le montant reçu par Stripe ne correspond pas au montant attendu (paiement ${escapeHtml(r.payment_id)}). L'accès n'a pas été ouvert.`)],
        footer: {},
      }),
    });
    return json({ ok: true, mismatch: true });
  }
  if (r?.result !== 'paid') return json({ ok: true, result: r?.result });

  // Emails : confirmation à l'acheteur, alerte à l'admin
  const { data: ex } = await db.from('exhibitors').select('name, slug').eq('id', r.exhibitor_id).maybeSingle();
  let eventName: string | null = null;
  if (r.event_id) {
    const { data: ev } = await db.from('events').select('nom_event').eq('id', r.event_id).maybeSingle();
    eventName = ev?.nom_event ?? null;
  }
  const exName = ex?.name ?? 'votre entreprise';
  const planLabel = r.plan === 'pass' ? 'Pass salon' : 'Annuel (12 mois)';
  const rows: Array<[string, string]> = [['Entreprise', exName], ['Formule', planLabel]];
  if (eventName) rows.push(['Salon', eventName]);
  rows.push(['Montant', euros(r.amount_cents)]);
  if (r.kept_annual) rows.push(['Accès', 'Votre Annuel en cours reste en place']);
  else rows.push(['Accès valable jusqu\'au', dateFr(r.valid_until)]);
  const manageUrl = ex?.slug ? `${SITE_URL}/exposants/${ex.slug}/gerer?section=leads` : SITE_URL;

  if (r.buyer_email) {
    const blocks = [
      heading('Merci, votre accès est ouvert'),
      paragraph(`Le paiement de <strong>${escapeHtml(exName)}</strong> est bien reçu. Toute votre équipe peut utiliser Lotexpo Leads, jusqu'à 15 utilisateurs.`),
      dataTable(rows),
    ];
    if (invoiceUrl) blocks.push(paragraph(`Votre facture : <a href="${escapeHtml(invoiceUrl)}">voir et télécharger la facture</a>.`));
    blocks.push(infoBox('Prochaine étape : invitez vos commerciaux depuis votre espace exposant, section Lotexpo Leads, puis créez l\'espace de votre salon.'));
    await safeSend({
      to: r.buyer_email,
      subject: 'Paiement reçu : votre accès à Lotexpo Leads est ouvert',
      replyTo: ADMIN_EMAIL,
      html: renderEmailShell({ title: 'Votre accès à Lotexpo Leads est ouvert', preheader: `${planLabel} pour ${exName}`, bodyBlocks: blocks, cta: { label: 'Ouvrir Lotexpo Leads', href: manageUrl }, footer: {} }),
      tags: [{ name: 'type', value: 'booth_payment_paid' }],
    });
  }

  await safeSend({
    to: ADMIN_EMAIL,
    subject: `💶 Paiement Lotexpo Leads : ${exName} (${planLabel})`,
    html: renderEmailShell({
      title: 'Nouveau paiement Lotexpo Leads',
      preheader: `${exName} a payé ${euros(r.amount_cents)}`,
      bodyBlocks: [heading('Nouveau paiement Lotexpo Leads'), dataTable([...rows, ['Payé par', r.buyer_email ?? 'Inconnu'], ['Entreprise sur la facture', s.customer_details?.business_name ?? 'Non renseignée']])],
      footer: {},
    }),
    tags: [{ name: 'type', value: 'booth_payment_admin' }],
  });

  return json({ ok: true, paid: true });
}

// deno-lint-ignore no-explicit-any
async function notifyAdminRefund(db: any, exhibitorId: string | null) {
  const { data: ex } = exhibitorId ? await db.from('exhibitors').select('name').eq('id', exhibitorId).maybeSingle() : { data: null };
  await safeSend({
    to: ADMIN_EMAIL,
    subject: `Remboursement Lotexpo Leads : ${ex?.name ?? 'entreprise'}`,
    html: renderEmailShell({
      title: 'Remboursement Lotexpo Leads',
      preheader: 'Un paiement Lotexpo Leads a été remboursé.',
      bodyBlocks: [heading('Paiement remboursé'), paragraph(`Le paiement de <strong>${escapeHtml(ex?.name ?? 'cette entreprise')}</strong> a été remboursé. L'accès n'a pas été coupé : révoquez-le depuis l'administration si nécessaire.`)],
      footer: {},
    }),
  });
}

async function safeSend(opts: Parameters<typeof sendResendEmail>[0]) {
  try {
    await sendResendEmail(opts);
  } catch (err) {
    console.error(LOG, 'email non envoyé', String(err));
  }
}
