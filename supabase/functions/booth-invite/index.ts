// booth-invite
//
// Lotexpo Leads : un manager invite un membre de son équipe.
// Appel depuis le site avec la session de l'utilisateur (verify_jwt = true).
//
// 1. Appelle la fonction serveur booth_invite_member AVEC la session de l'appelant :
//    tous les contrôles (manager, formule, limite de comptes, email) sont faits par la base.
// 2. Envoie l'email d'invitation avec le lien d'acceptation.
// 3. Renvoie aussi le lien au manager, pour qu'il puisse le transmettre lui-même si l'email échoue.
//
// Le jeton n'est jamais stocké en clair : la base ne garde que son empreinte SHA-256.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph, infoBox } from '../_shared/email-template.ts';

const SITE_URL = 'https://lotexpo.com';
const LOG = '[booth-invite]';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROR_STATUS: Record<string, number> = {
  BOOTH_AUTH_REQUIRED: 401,
  BOOTH_FORBIDDEN: 403,
  BOOTH_PLAN_REQUIRED: 402,
  BOOTH_SEATS_FULL: 409,
  BOOTH_ALREADY_MEMBER: 409,
  BOOTH_INVALID_INPUT: 400,
  BOOTH_DISABLED: 503,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'BOOTH_AUTH_REQUIRED' }, 401);

  let body: { exhibitor_id?: string; email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }
  const exhibitorId = body.exhibitor_id ?? '';
  const email = (body.email ?? '').trim();
  const role = body.role === 'manager' ? 'manager' : 'field';
  if (!UUID_RE.test(exhibitorId) || !email) return json({ error: 'BOOTH_INVALID_INPUT' }, 400);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  // Client "utilisateur" : la base voit l'appelant réel (auth.uid()) et applique ses contrôles
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: invite, error: rpcErr } = await userClient.rpc('booth_invite_member', {
    p_exhibitor_id: exhibitorId,
    p_email: email,
    p_role: role,
  });
  if (rpcErr) {
    const code = Object.keys(ERROR_STATUS).find((k) => rpcErr.message?.includes(k)) ?? 'BOOTH_ERROR';
    return json({ error: code }, ERROR_STATUS[code] ?? 500);
  }

  const token: string = invite?.token;
  const inviteUrl = `${SITE_URL}/leads/invitation?token=${token}`;

  // Libellés pour l'email (clé de service, lecture seule)
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const { data: exhibitor } = await db.from('exhibitors').select('name').eq('id', exhibitorId).maybeSingle();
  const { data: userData } = await userClient.auth.getUser();
  let inviterName = userData?.user?.email ?? 'Votre responsable';
  if (userData?.user?.id) {
    const { data: profile } = await db.from('profiles').select('first_name, last_name').eq('user_id', userData.user.id).maybeSingle();
    const full = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
    if (full) inviterName = full;
  }
  const exhibitorName = exhibitor?.name ?? 'votre entreprise';
  const roleLabel = role === 'manager' ? 'manager' : 'commercial terrain';

  let emailSent = false;
  try {
    const subject = `${inviterName} vous invite à rejoindre l'équipe ${exhibitorName} sur Lotexpo Leads`;
    await sendResendEmail({
      to: invite.email,
      subject,
      html: renderEmailShell({
        title: subject,
        preheader: `Rejoignez l'équipe ${exhibitorName} pour enregistrer vos rencontres sur les salons.`,
        bodyBlocks: [
          heading('Vous êtes invité sur Lotexpo Leads'),
          paragraph(`<strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre l'équipe <strong>${escapeHtml(exhibitorName)}</strong> en tant que ${roleLabel}.`),
          paragraph('Lotexpo Leads vous permet d\'enregistrer en quelques secondes chaque rencontre sur le stand, même sans réseau, et de suivre les actions après le salon.'),
          infoBox(`Connectez-vous ou créez votre compte avec cette adresse email : <strong>${escapeHtml(invite.email)}</strong>. L'invitation est valable 14 jours.`),
        ],
        cta: { label: 'Rejoindre l\'équipe', href: inviteUrl },
        footer: {},
      }),
      tags: [{ name: 'type', value: 'booth_invite' }],
    });
    emailSent = true;
  } catch (err) {
    console.error(LOG, 'email failed', String(err));
  }

  return json({
    member_id: invite.member_id,
    email: invite.email,
    role: invite.role,
    expires_at: invite.expires_at,
    invite_url: inviteUrl,
    email_sent: emailSent,
  });
});
