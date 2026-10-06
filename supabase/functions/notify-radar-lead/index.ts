// notify-radar-lead
// Webhook base de données sur INSERT dans radar_leads -> email à admin@lotexpo.com via Resend.
// Mise en forme : gabarit commun _shared/email-template.ts (DA Lotexpo).
import { renderEmailShell, heading, paragraph, dataTable } from '../_shared/email-template.ts';

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

function buildHtml(r: RadarLeadRecord): string {
  const name = String(r.contact_name ?? '').trim() || '—';
  const v = (x: unknown) => String(x ?? '').trim() || '—';
  return renderEmailShell({
    title: 'Nouveau lead Directeur Commercial',
    preheader: `${name} demande la version connectée depuis la page Directeur Commercial.`,
    bodyBlocks: [
      heading('🎯 Nouveau lead Directeur Commercial'),
      paragraph(`<strong>${esc(name)}</strong> vient de demander la version connectée depuis la page Directeur Commercial.`),
      dataTable([
        ['Contact', v(r.contact_name)],
        ['Email', v(r.contact_email)],
        ['CRM', v(r.crm)],
        ["Taille d'équipe", v(r.team_size)],
        ['Type de clientèle', v(r.client_type)],
        ['Type de produit', v(r.product_type)],
        ['Salons par an', v(r.salons_per_year)],
        ['Entreprise recherchée', v(r.searched_query)],
        ['Message', v(r.message)],
        ['Date', fr(r.created_at)],
      ]),
      paragraph('<span style="font-size:14px;color:#5c6684;">Lead enregistré dans la table radar_leads. Retrouvez tous les leads dans l’administration.</span>'),
    ],
    cta: { label: 'Ouvrir l’administration', href: 'https://lotexpo.com/admin' },
  });
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

