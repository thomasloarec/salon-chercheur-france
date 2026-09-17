// notify-exhibitor-participation-request
//
// Recoit un payload de Database Webhook sur INSERT dans
// `exhibitor_participation_requests` et envoie un email a admin@lotexpo.com
// via Resend.
//
// Reutilisation existante :
//   - Secret Resend : RESEND_API_KEY (identique aux autres notifications).
//   - Expediteur verifie : RESEND_FROM_EMAIL, via le helper sendResendEmail.
//   - Aucun nouveau secret.
//
// Presentation : HTML construit par le gabarit partage _shared/email-template.ts.
//
// Pas d'echec silencieux : une erreur Resend est loguee et renvoie un statut
// non-200. Un payload inattendu renvoie 200 sans envoi, pour ne pas casser le
// webhook.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph, dataTable } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'admin@lotexpo.com';
const SITE_URL = 'https://lotexpo.com';

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return 'Non renseigné';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function formatDayFr(iso: string | null | undefined): string {
  if (!iso) return 'Non renseignée';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

interface RequestRecord {
  id?: string;
  exhibitor_id?: string | null;
  event_id?: string | null;
  proposed_event_name?: string | null;
  proposed_event_url?: string | null;
  proposed_event_city?: string | null;
  proposed_event_start?: string | null;
  stand?: string | null;
  message?: string | null;
  status?: string | null;
  created_at?: string | null;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: RequestRecord | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    console.warn('[notify-exhibitor-participation-request] invalid JSON body');
    return jsonResp({ ok: true, skipped: 'invalid_json' });
  }

  const isExpectedInsert =
    payload?.type === 'INSERT' &&
    payload?.table === 'exhibitor_participation_requests' &&
    payload?.record &&
    typeof payload.record === 'object';
  if (!isExpectedInsert) {
    return jsonResp({ ok: true, skipped: 'not_expected_insert' });
  }

  const record = payload.record as RequestRecord;

  // Lecture des libelles (entreprise, salon) avec la cle de service.
  let exhibitorName = 'Entreprise inconnue';
  let exhibitorSlug: string | null = null;
  let eventName: string | null = null;
  let eventSlug: string | null = null;

  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    if (record.exhibitor_id) {
      const { data } = await serviceClient
        .from('exhibitors')
        .select('name, slug')
        .eq('id', record.exhibitor_id)
        .maybeSingle();
      if (data) {
        exhibitorName = data.name ?? exhibitorName;
        exhibitorSlug = data.slug ?? null;
      }
    }

    if (record.event_id) {
      const { data } = await serviceClient
        .from('events')
        .select('nom_event, slug')
        .eq('id', record.event_id)
        .maybeSingle();
      if (data) {
        eventName = data.nom_event ?? null;
        eventSlug = data.slug ?? null;
      }
    }
  } catch (err) {
    console.warn('[notify-exhibitor-participation-request] lookup failed', String(err));
  }

  const exhibitorLink = exhibitorSlug
    ? `<a href="${SITE_URL}/exposants/${escapeHtml(exhibitorSlug)}">${escapeHtml(exhibitorName)}</a>`
    : escapeHtml(exhibitorName);

  const salonLabel = record.event_id
    ? (eventSlug
        ? `<a href="${SITE_URL}/events/${escapeHtml(eventSlug)}">${escapeHtml(eventName ?? 'Salon existant')}</a>`
        : escapeHtml(eventName ?? 'Salon existant'))
    : escapeHtml(record.proposed_event_name ?? 'Salon non renseigné');

  const rows: Array<[string, string]> = [
    ['Entreprise', exhibitorLink],
    ['Salon', salonLabel],
  ];

  if (!record.event_id) {
    rows.push(['Salon hors Lotexpo', 'Oui, à créer avant validation']);
    rows.push(['Ville du salon', record.proposed_event_city ?? 'Non renseignée']);
    rows.push(['Date de début', formatDayFr(record.proposed_event_start)]);
    rows.push([
      'Site du salon',
      record.proposed_event_url
        ? `<a href="${escapeHtml(record.proposed_event_url)}">${escapeHtml(record.proposed_event_url)}</a>`
        : 'Non renseigné',
    ]);
  }

  rows.push(['Stand', record.stand ?? 'Non renseigné']);
  rows.push(['Message', record.message ? escapeHtml(record.message) : 'Aucun message']);
  rows.push(['Date de la demande', formatDateFr(record.created_at)]);

  const html = renderEmailShell({
    title: 'Nouvelle participation salon déclarée',
    preheader: `${exhibitorName} déclare une participation à un salon.`,
    bodyBlocks: [
      heading('🔔 Nouvelle participation salon déclarée'),
      paragraph(`<strong>${escapeHtml(exhibitorName)}</strong> vient de déclarer une participation à un salon.`),
      dataTable(rows),
      paragraph(
        "Cette demande est en attente de validation dans l'administration. Rien n'est visible publiquement tant qu'elle n'est pas validée.",
      ),
    ],
    // Email interne a l'admin : pas de lien de desinscription (transactionnel).
    footer: {},
  });

  const subject = `🔔 Participation salon déclarée : ${exhibitorName}`;

  try {
    const result = await sendResendEmail({
      to: ADMIN_EMAIL,
      subject,
      html,
      tags: [{ name: 'type', value: 'exhibitor_participation_request' }],
    });
    console.log('[notify-exhibitor-participation-request] email sent', { id: result.id, request: record.id });
    return jsonResp({ ok: true, id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[notify-exhibitor-participation-request] send failed', message);
    return jsonResp({ ok: false, error: message }, 500);
  }
});
