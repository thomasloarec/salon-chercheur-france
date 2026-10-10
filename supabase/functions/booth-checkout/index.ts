// booth-checkout
//
// Lotexpo Leads : crée une page de paiement Stripe (Checkout) pour le Pass salon ou l'Annuel.
// Appel depuis le site avec la session de l'utilisateur (verify_jwt = true).
//
// 1. booth_checkout_prepare est appelée AVEC la session de l'appelant : droits (administrateur
//    de la fiche), formule, salon, montant et prix sont décidés par la base, jamais par le navigateur.
// 2. La session Stripe est créée (facture automatique, nom de l'entreprise, adresse, numéro de TVA).
// 3. La session est rattachée au paiement (_booth_payment_attach, clé de service).
// L'accès n'est ouvert QUE par le webhook Stripe signé (booth-stripe-webhook).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { keyIsLive, stripeRequest } from '../_shared/stripe.ts';

const LOG = '[booth-checkout]';
const DEFAULT_SITE = 'https://lotexpo.com';
const FRANCHISE_MENTION = 'TVA non applicable, art. 293 B du CGI';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROR_STATUS: Record<string, number> = {
  BOOTH_AUTH_REQUIRED: 401,
  BOOTH_FORBIDDEN: 403,
  BOOTH_NOT_FOUND: 404,
  BOOTH_INVALID_INPUT: 400,
  BOOTH_EVENT_PAST: 409,
  BOOTH_ALREADY_COVERED: 409,
  BOOTH_ALREADY_PAID: 409,
  BOOTH_RATE_LIMITED: 429,
  BOOTH_DISABLED: 503,
};

/** Retour sur le site d'origine s'il est connu (production ou aperçu Lovable), sinon lotexpo.com. */
function siteFrom(req: Request): string {
  const origin = req.headers.get('Origin') ?? '';
  try {
    const u = new URL(origin);
    const h = u.hostname;
    if (u.protocol === 'https:' && (h === 'lotexpo.com' || h === 'www.lotexpo.com' || h.endsWith('.lovable.app') || h.endsWith('.lovableproject.com'))) {
      return u.origin;
    }
  } catch { /* origine absente ou invalide */ }
  return DEFAULT_SITE;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'BOOTH_AUTH_REQUIRED' }, 401);

  let body: { exhibitor_id?: string; plan?: string; event_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }
  const exhibitorId = body.exhibitor_id ?? '';
  const plan = body.plan === 'annual' ? 'annual' : body.plan === 'pass' ? 'pass' : '';
  const eventId = body.event_id ?? null;
  if (!UUID_RE.test(exhibitorId) || !plan || (eventId !== null && !UUID_RE.test(eventId))) {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  // Configuration : la clé et le réglage de la base doivent être dans le même mode (test ou réel)
  let live: boolean;
  try {
    live = keyIsLive();
  } catch {
    console.error(LOG, 'clé Stripe absente');
    return json({ error: 'BOOTH_PAYMENT_UNAVAILABLE' }, 503);
  }

  const { data: prep, error: rpcErr } = await userClient.rpc('booth_checkout_prepare', {
    p_exhibitor_id: exhibitorId,
    p_plan: plan,
    p_event_id: plan === 'pass' ? eventId : null,
  });
  if (rpcErr) {
    const code = Object.keys(ERROR_STATUS).find((k) => rpcErr.message?.includes(k)) ?? 'BOOTH_ERROR';
    return json({ error: code }, ERROR_STATUS[code] ?? 500);
  }
  if (Boolean(prep.livemode) !== live) {
    console.error(LOG, 'mode Stripe incohérent entre la clé et booth_billing_settings', { settingsLive: prep.livemode, keyLive: live });
    return json({ error: 'BOOTH_PAYMENT_UNAVAILABLE' }, 503);
  }

  const site = siteFrom(req);
  const back = `${site}/exposants/${encodeURIComponent(prep.exhibitor_slug)}/gerer?section=leads`;
  const planLabel = plan === 'pass' ? 'Pass salon' : 'Annuel (12 mois)';
  const description = plan === 'pass'
    ? `Lotexpo Leads, Pass salon : ${prep.event_name} (${prep.exhibitor_name})`
    : `Lotexpo Leads, Annuel 12 mois (${prep.exhibitor_name})`;
  const metadata = {
    source: 'lotexpo_leads',
    payment_id: prep.payment_id,
    exhibitor_id: prep.exhibitor_id,
    plan,
    event_id: prep.event_id ?? '',
  };

  let session: { id: string; url: string };
  try {
    session = await stripeRequest('POST', '/checkout/sessions', {
      mode: 'payment',
      line_items: [{ price: prep.price_id, quantity: 1 }],
      customer_email: prep.buyer_email ?? undefined,
      customer_creation: 'always',
      client_reference_id: prep.payment_id,
      metadata,
      payment_intent_data: { metadata, description },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description,
          footer: prep.vat_mode === 'franchise' ? FRANCHISE_MENTION : undefined,
          metadata,
        },
      },
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      name_collection: { business: { enabled: true } },
      locale: 'fr',
      submit_type: 'pay',
      custom_text: {
        submit: { message: `${planLabel} pour ${prep.exhibitor_name}. L'accès s'ouvre dès le paiement validé ; la facture vous est envoyée par email.` },
      },
      success_url: `${back}&paiement=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}&paiement=annule`,
    }, `booth-checkout-${prep.payment_id}`);
  } catch (err) {
    console.error(LOG, 'création de session refusée', String(err));
    return json({ error: 'BOOTH_PAYMENT_UNAVAILABLE' }, 502);
  }

  const { error: attachErr } = await db.rpc('_booth_payment_attach', { p_payment_id: prep.payment_id, p_session_id: session.id });
  if (attachErr) {
    console.error(LOG, 'rattachement de session impossible', attachErr.message);
    return json({ error: 'BOOTH_ERROR' }, 500);
  }

  console.log(LOG, 'session créée', { payment: prep.payment_id, plan, live });
  return json({ url: session.url, payment_id: prep.payment_id });
});
