// notify-radar-lead
// Webhook base de données sur INSERT dans radar_leads -> email à admin@lotexpo.com via Resend.
// Autonome (aucun import _shared) pour un déploiement direct et vérifiable.

const ADMIN_EMAIL = 'admin@lotexpo.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function esc(s: unknown): string {
  return String(s ?? '')
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;');
}

function fr(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

interface RadarLeadRecord {
  id?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  crm?: string | null;
  team_size?: string | null;
  client_type?: string | null;
  product_type?: string | null;
  salons_per_year?: string | null;
  searched_query?: string | null;
  message?: string | null;
  created_at?: string | null;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: RadarLeadRecord | null;
  old_record?: unknown;
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Lotexpo <admin@lotexpo.com>';
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      tags: [{ name: 'type', value: 'radar_lead' }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Resend ${resp.status}: ${t}`);
  }
  return await resp.json();
}

function rowHtml(label: string, value: unknown): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-weight:600;vertical-align:top;">${esc(label)}</td><td style="padding:6px 0;color:#111827;vertical-align:top;">${esc(value ?? '—')}</td></tr>`;
}

function buildHtml(r: RadarLeadRecord): string {
  const name = String(r.contact_name ?? '').trim() || '—';
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>🎯 Nouveau lead Directeur Commercial</title>
</head>
<body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;padding:24px;color:#111827;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="margin-top:0;color:#6b51ff;">🎯 Nouveau lead Directeur Commercial</h1>
    <p style="font-size:16px;line-height:1.5;">
      <strong>${esc(name)}</strong> vient de demander la version connectée depuis la page Directeur Commercial.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
      ${rowHtml('Contact', r.contact_name)}
      ${rowHtml('Email', r.contact_email)}
      ${rowHtml('CRM', r.crm)}
      ${rowHtml("Taille d'équipe", r.team_size)}
      ${rowHtml('Type de clientèle', r.client_type)}
      ${rowHtml('Type de produit', r.product_type)}
      ${rowHtml('Salons par an', r.salons_per_year)}
      ${rowHtml('Entreprise recherchée', r.searched_query)}
      ${rowHtml('Message', r.message)}
      ${rowHtml('Date', fr(r.created_at))}
    </table>
    <p style="margin-top:24px;font-size:13px;color:#6b7280;">
      Lead enregistré dans <code>radar_leads</code>. Retrouvez tous les leads dans l'Admin.
    </p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method_not_allowed' }, 405);

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResp({ ok: true, skipped: 'invalid_json' });
  }

  const ok =
    payload?.type === 'INSERT' &&
    payload?.table === 'radar_leads' &&
    payload?.record &&
    typeof payload.record === 'object';
  if (!ok) return jsonResp({ ok: true, skipped: 'not_expected_insert' });

  const r = payload.record as RadarLeadRecord;
  const subject = `🎯 Nouveau lead Directeur Commercial — ${String(r.contact_name ?? '').trim() || '—'} (${r.crm ?? '—'})`;

  try {
    const result = await sendEmail(ADMIN_EMAIL, subject, buildHtml(r));
    console.log('[notify-radar-lead] email sent', { id: result?.id, lead: r.id });
    return jsonResp({ ok: true, id: result?.id });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error('[notify-radar-lead] send failed', m);
    return jsonResp({ ok: false, error: m }, 500);
  }
});
