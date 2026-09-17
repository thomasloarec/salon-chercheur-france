// exhibitor-participation-decide
//
// Applique une decision admin (approved / rejected) sur une demande de
// participation salon, puis notifie les gestionnaires actifs de l'exposant
// (notification in-app + email Resend).
//
// Auth : JWT du caller (meme mecanisme que exhibitors-manage), role admin requis.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResp({ error: 'Authentication required' }, 401);
  }

  let body: { request_id?: string; decision?: string; admin_note?: string | null };
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: 'Invalid JSON body' }, 400);
  }

  const requestId = typeof body.request_id === 'string' ? body.request_id : '';
  const decision = body.decision === 'approved' || body.decision === 'rejected' ? body.decision : null;
  const adminNote = typeof body.admin_note === 'string' && body.admin_note.trim()
    ? body.admin_note.trim()
    : null;

  if (!requestId || !decision) {
    return jsonResp({ error: 'request_id et decision sont obligatoires' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Client porteur du JWT admin : sert a l'authentification et a la RPC.
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return jsonResp({ error: 'Authentication required' }, 401);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: isAdminData } = await serviceClient.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin',
  });
  if (!isAdminData) {
    return jsonResp({ error: 'Accès réservé aux administrateurs' }, 403);
  }

  // Demande avant decision (pour construire les messages).
  const { data: request, error: requestError } = await serviceClient
    .from('exhibitor_participation_requests')
    .select('id, exhibitor_id, event_id, proposed_event_name, stand, status')
    .eq('id', requestId)
    .maybeSingle();
  if (requestError || !request) {
    return jsonResp({ error: 'Demande introuvable' }, 404);
  }

  // Application de la decision via la RPC existante, avec le JWT admin.
  const { error: rpcError } = await authClient.rpc('review_participation_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_admin_note: adminNote,
  });
  if (rpcError) {
    console.error('[exhibitor-participation-decide] rpc failed', rpcError.message);
    return jsonResp({ error: rpcError.message }, 400);
  }

  // ── Notifications aux gestionnaires actifs (jamais bloquantes) ──
  try {
    let salonName = request.proposed_event_name ?? 'ce salon';
    if (request.event_id) {
      const { data: ev } = await serviceClient
        .from('events')
        .select('nom_event')
        .eq('id', request.event_id)
        .maybeSingle();
      if (ev?.nom_event) salonName = ev.nom_event;
    }

    const { data: exhibitor } = await serviceClient
      .from('exhibitors')
      .select('name')
      .eq('id', request.exhibitor_id)
      .maybeSingle();
    const exhibitorName = exhibitor?.name ?? 'Votre entreprise';

    const { data: publicProfile } = await serviceClient
      .from('public_exhibitor_profiles')
      .select('public_slug')
      .eq('exhibitor_id', request.exhibitor_id)
      .maybeSingle();
    const managePath = publicProfile?.public_slug
      ? `/exposants/${publicProfile.public_slug}/gerer`
      : '/profile';

    const { data: members } = await serviceClient
      .from('exhibitor_team_members')
      .select('user_id')
      .eq('exhibitor_id', request.exhibitor_id)
      .eq('status', 'active')
      .in('role', ['owner', 'admin']);

    const userIds = Array.from(new Set((members ?? []).map((m: { user_id: string }) => m.user_id)));

    const approved = decision === 'approved';
    const title = approved ? 'Participation confirmée' : 'Participation refusée';
    const message = approved
      ? `Votre participation à ${salonName} a été confirmée.`
      : `Votre demande de participation à ${salonName} a été refusée.${adminNote ? ` Motif : ${adminNote}` : ''}`;

    if (userIds.length > 0) {
      const { error: notifError } = await serviceClient.from('notifications').insert(
        userIds.map((uid) => ({
          user_id: uid,
          type: approved ? 'participation_approved' : 'participation_rejected',
          category: 'exhibitor_mgmt',
          title,
          message,
          icon: approved ? '✅' : '❌',
          exhibitor_id: request.exhibitor_id,
          event_id: request.event_id ?? null,
          link_url: managePath,
          metadata: { participation_request_id: request.id },
        })),
      );
      if (notifError) {
        console.error('[exhibitor-participation-decide] notification insert failed', notifError.message);
      }
    }

    // Emails aux gestionnaires.
    const html = renderEmailShell({
      title,
      preheader: message,
      bodyBlocks: [
        heading(approved ? '✅ Participation confirmée' : '❌ Participation refusée'),
        paragraph(`Bonjour,`),
        paragraph(
          approved
            ? `La participation de <strong>${escapeHtml(exhibitorName)}</strong> au salon <strong>${escapeHtml(salonName)}</strong> a été confirmée par l'équipe Lotexpo. Elle est désormais visible sur la page du salon.`
            : `La demande de participation de <strong>${escapeHtml(exhibitorName)}</strong> au salon <strong>${escapeHtml(salonName)}</strong> n'a pas été retenue.${adminNote ? ` Motif : ${escapeHtml(adminNote)}` : ''}`,
        ),
      ],
      cta: {
        label: 'Gérer mes salons',
        href: `${SITE_URL}${managePath}`,
      },
      footer: {},
    });

    for (const uid of userIds) {
      try {
        const { data: authUser } = await serviceClient.auth.admin.getUserById(uid);
        const email = authUser?.user?.email;
        if (!email) continue;
        await sendResendEmail({
          to: email,
          subject: approved
            ? `Participation confirmée : ${salonName}`
            : `Participation refusée : ${salonName}`,
          html,
          tags: [{ name: 'type', value: approved ? 'participation_approved' : 'participation_rejected' }],
        });
      } catch (mailErr) {
        console.error('[exhibitor-participation-decide] email failed', uid, String(mailErr));
      }
    }
  } catch (err) {
    console.error('[exhibitor-participation-decide] notify step failed', String(err));
  }

  return jsonResp({ ok: true, decision });
});
