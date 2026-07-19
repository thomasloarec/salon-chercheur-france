// notify-radar-access-approved
//
// Called by an authenticated ADMIN from the UI *after* an access request has
// been approved (the plan flip happens elsewhere via admin_approve_access_request).
// This function only sends a best-effort "your Radar CRM access is open" email to
// the requester. An email failure must NOT break the approval flow: the function
// always returns success:true with emailSent:true|false.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c]!),
  );
}

function renderApprovalEmail(firstName: string | null, appBaseUrl: string) {
  const hello = firstName ? `Bonjour ${escapeHtml(firstName)},` : 'Bonjour,';
  const ctaUrl = `${appBaseUrl}/radar-crm`;
  const subject = 'Votre accès Radar CRM est ouvert';

  const html = renderEmailShell({
    title: subject,
    preheader: 'Votre accès à Radar CRM est désormais actif.',
    bodyBlocks: [
      heading('Votre accès Radar CRM est ouvert'),
      paragraph(hello),
      paragraph("Votre accès à Radar CRM est désormais actif. Vous pouvez importer votre fichier CRM et voir, salon par salon, quelles entreprises de votre portefeuille exposent prochainement — pour préparer vos rendez-vous en amont."),
    ],
    cta: { label: 'Accéder à Radar CRM', href: ctaUrl },
    footer: { extraHtml: "Vous recevez cet email car votre demande d'accès à Radar CRM sur Lotexpo a été acceptée." },
  });

  const text = [
    'Lotexpo · Radar CRM',
    'Votre accès Radar CRM est ouvert',
    '',
    hello,
    "Votre accès à Radar CRM est désormais actif. Vous pouvez importer votre fichier CRM et voir, salon par salon, quelles entreprises de votre portefeuille exposent prochainement.",
    '',
    `Accéder à Radar CRM : ${ctaUrl}`,
    '',
    "Vous recevez cet email car votre demande d'accès à Radar CRM sur Lotexpo a été acceptée.",
  ].join('\n');

  return { html, text, subject };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Server misconfigured' }, 500);

  // Admin auth.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  if (!token) return json({ error: 'Unauthorized' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', {
    _user_id: userData.user.id,
    _role: 'admin',
  } as never);
  if (roleErr || isAdmin !== true) return json({ error: 'Forbidden' }, 403);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const requestId =
    typeof body?.request_id === 'string' && body.request_id ? body.request_id : null;
  if (!requestId) return json({ error: 'request_id required' }, 400);

  const { data: reqRow, error: reqErr } = await admin
    .from('radar_access_requests')
    .select('id, email, first_name, status')
    .eq('id', requestId)
    .maybeSingle();
  if (reqErr) return json({ error: reqErr.message }, 500);
  if (!reqRow) return json({ error: 'request not found' }, 404);
  if (!reqRow.email) return json({ success: true, emailSent: false, reason: 'no_email' });

  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://lotexpo.com';
  const { html, text, subject } = renderApprovalEmail(
    reqRow.first_name as string | null,
    appBaseUrl,
  );

  try {
    const { id } = await sendResendEmail({
      to: reqRow.email as string,
      subject,
      html,
      text,
      tags: [
        { name: 'feature', value: 'radar_crm' },
        { name: 'email_type', value: 'access_approved' },
      ],
    });
    return json({ success: true, emailSent: true, emailTo: reqRow.email, resendMessageId: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('approval email failed', { requestId, message: msg });
    return json({ success: true, emailSent: false, emailTo: reqRow.email, error: msg });
  }
});