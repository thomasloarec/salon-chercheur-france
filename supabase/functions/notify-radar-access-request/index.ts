// notify-radar-access-request
//
// Receives a Supabase Database Webhook payload on INSERT into
// `radar_access_requests` and emails admin@lotexpo.com via Resend.
//
// Auto-diagnostic reuse:
//   - Resend secret: RESEND_API_KEY (same as radar-crm-email-dispatcher).
//   - Verified sender: RESEND_FROM_EMAIL (default "Lotexpo <admin@lotexpo.com>",
//     send.lotexpo.com), via the shared sendResendEmail helper.
//   - No new secret is created.
//
// No silent failure: a Resend error is logged and returns a non-200 status so
// the webhook sees the failure. A non-INSERT / unexpected payload returns 200
// without sending, so the webhook is never broken by unrelated events.
import { sendResendEmail } from '../_shared/resend.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'admin@lotexpo.com';

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
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

interface AccessRequestRecord {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  company?: string | null;
  job_title?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  radar_account_id?: string | null;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: AccessRequestRecord | null;
  old_record?: unknown;
}

function buildHtml(r: AccessRequestRecord): string {
  const fullName = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || '—';
  const row = (label: string, value: unknown) => `
    <tr>
      <td style="padding:8px 12px;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;color:#111827;font-size:14px;font-weight:500;">${escapeHtml(value ?? '—') || '—'}</td>
    </tr>`;
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#111827;padding:20px 24px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;">🔔 Nouvelle demande d'accès Radar CRM</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;color:#374151;font-size:14px;">
            <strong>${escapeHtml(fullName)}</strong>${r.company ? ` — ${escapeHtml(r.company)}` : ''} vient de demander l'accès à Radar CRM.
          </p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #f3f4f6;border-radius:8px;">
            ${row('Prénom', r.first_name)}
            ${row('Nom', r.last_name)}
            ${row('Email', r.email)}
            ${row('Entreprise', r.company)}
            ${row('Fonction', r.job_title)}
            ${row('Téléphone', r.phone)}
            ${row('Date', formatDateFr(r.created_at))}
          </table>
          <p style="margin:20px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">
            Activez l'accès depuis l'onglet admin Radar CRM (ou via <code>admin_approve_access_request</code>).
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
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
    // Malformed body: acknowledge so the webhook doesn't keep retrying.
    console.warn('[notify-radar-access-request] invalid JSON body');
    return jsonResp({ ok: true, skipped: 'invalid_json' });
  }

  // Only react to INSERTs on the expected table; otherwise no-op (200).
  const isExpectedInsert =
    payload?.type === 'INSERT' &&
    payload?.table === 'radar_access_requests' &&
    payload?.record &&
    typeof payload.record === 'object';
  if (!isExpectedInsert) {
    return jsonResp({ ok: true, skipped: 'not_expected_insert' });
  }

  const record = payload.record as AccessRequestRecord;
  const fullName = `${record.first_name ?? ''} ${record.last_name ?? ''}`.trim() || 'Demande';
  const subject = `🔔 Nouvelle demande d'accès Radar CRM — ${fullName} (${record.company ?? '—'})`;

  try {
    const result = await sendResendEmail({
      to: ADMIN_EMAIL,
      subject,
      html: buildHtml(record),
      tags: [{ name: 'type', value: 'radar_access_request' }],
    });
    console.log('[notify-radar-access-request] email sent', { id: result.id, request: record.id });
    return jsonResp({ ok: true, id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[notify-radar-access-request] send failed', message);
    return jsonResp({ ok: false, error: message }, 500);
  }
});