// Radar CRM salon transactional notifier.
//
// Sends the two Radar CRM salon "pivot" transactional emails FROM the site
// notifications already created by SQL crons:
//   - type 'radar_salon_live'    -> "Votre salon commence aujourd'hui" (CTA Mode Salon)
//   - type 'radar_salon_debrief' -> "Débriefez votre salon" (CTA Débrief)
//
// This function DOES NOT create notifications. It reads recent ones and sends
// the matching email. It is independent from radar-crm-email-dispatcher (the
// detection digest) and never touches it.
//
// Modes (same safety model as the dispatcher):
//   - dryRun=true (default): no send, no DB writes; returns a preview.
//   - sendReal=true + dryRun=false: real send.
//       * batch (no userId): service_role ONLY.
//       * single userId: admin JWT or service_role.
//
// Per notification:
//   1. opt-in check (radar_email_enabled=true AND radar_email_unsubscribed_at IS NULL).
//      NO weekly quota here.
//   2. dedup: skip if notification.id already in a sent (dry_run=false) log row.
//   3. resolve user email (auth admin getUserById).
//   4. build + send email (Resend), tags feature=radar_crm, email_type=<type>, environment=beta.
//   5. log in radar_email_log.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmailShell, heading, paragraph, infoBox } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SALON_TYPES = [
  'radar_salon_live',
  'radar_salon_debrief',
  'radar_task_due',
  'radar_prep_reminder',
  'radar_hot_prospect',
] as const;
type SalonType = (typeof SALON_TYPES)[number];

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

type AuthMode = 'service_role' | 'admin';

async function authorizeRequest(
  req: Request,
): Promise<{ ok: true; mode: AuthMode } | { ok: false; status: number; error: string }> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!serviceRoleKey || !supabaseUrl) {
    return { ok: false, status: 500, error: 'Server misconfigured' };
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return { ok: false, status: 401, error: 'Unauthorized' };
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };
  if (timingSafeEqual(token, serviceRoleKey)) return { ok: true, mode: 'service_role' };

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!anonKey) return { ok: false, status: 401, error: 'Unauthorized' };
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, status: 401, error: 'Unauthorized' };

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: isAdmin, error: adminErr } = await adminClient.rpc('has_role', {
    _user_id: userData.user.id,
    _role: 'admin',
  } as never);
  if (adminErr || isAdmin !== true) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true, mode: 'admin' };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: SalonType;
  event_id: string | null;
  title: string | null;
  message: string | null;
  link_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

async function ensureUnsubscribeUrl(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('scope', 'radar_crm')
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let token = (existing as { token?: string } | null)?.token ?? null;
  if (!token) {
    const { data: inserted, error } = await supabase
      .from('email_unsubscribe_tokens')
      .insert({ user_id: userId, scope: 'radar_crm' })
      .select('token').single();
    if (error) throw new Error(`unsubscribe token: ${error.message}`);
    token = (inserted as { token: string }).token;
  }

  const base = Deno.env.get('SUPABASE_URL') ?? '';
  return `${base}/functions/v1/radar-crm-unsubscribe?token=${token}`;
}

type SalonCopy = { subject: string; title: string; ctaLabel: string };

function copyFor(type: SalonType, eventName: string): SalonCopy {
  switch (type) {
    case 'radar_salon_live':
      return {
        subject: `${eventName} commence aujourd'hui`,
        title: 'Votre salon commence aujourd\u2019hui',
        ctaLabel: 'Entrer en Mode Salon',
      };
    case 'radar_salon_debrief':
      return {
        subject: `Débriefez ${eventName}`,
        title: 'Votre salon est terminé',
        ctaLabel: 'Voir le débrief',
      };
    case 'radar_task_due':
      return {
        subject: 'Une relance à faire aujourd\u2019hui',
        title: 'Une relance à faire aujourd\u2019hui',
        ctaLabel: 'Voir le compte',
      };
    case 'radar_prep_reminder':
      return {
        subject: `${eventName} dans 7 jours — préparez votre visite`,
        title: `${eventName} dans 7 jours`,
        ctaLabel: 'Préparer ma visite',
      };
    case 'radar_hot_prospect':
      return {
        subject: 'Un prospect chaud expose bientôt',
        title: 'Un prospect chaud expose bientôt',
        ctaLabel: 'Voir le salon',
      };
    default:
      return {
        subject: eventName,
        title: eventName,
        ctaLabel: 'Ouvrir Radar CRM',
      };
  }
}

function renderSalonEmail(args: {
  type: SalonType;
  eventName: string;
  message: string;
  ctaUrl: string;
  unsubscribeUrl: string;
}): { html: string; text: string; subject: string } {
  const copy = copyFor(args.type, args.eventName);
  const eventName = escapeHtml(args.eventName);
  const body = escapeHtml(args.message).replace(/\n/g, '<br/>');
  const ctaUrl = args.ctaUrl;
  const unsubscribeUrl = args.unsubscribeUrl;
  const preheaderByType: Record<SalonType, string> = {
    radar_salon_live: `${args.eventName} ouvre aujourd\u2019hui. Préparez vos rendez-vous.`,
    radar_salon_debrief: `${args.eventName} est terminé. Débriefez et exportez vos contacts.`,
    radar_task_due: 'Une relance vous attend aujourd\u2019hui sur Radar CRM.',
    radar_prep_reminder: `${args.eventName} approche. Préparez votre visite dès maintenant.`,
    radar_hot_prospect: 'Un prospect chaud expose bientôt. Anticipez le rendez-vous.',
  };
  const preheader = preheaderByType[args.type];

  const html = renderEmailShell({
    title: copy.subject,
    preheader,
    bodyBlocks: [
      heading(copy.title),
      paragraph(body),
      infoBox(`<strong>${eventName}</strong>`),
    ],
    cta: { label: copy.ctaLabel, href: ctaUrl },
    footer: {
      unsubscribeUrl,
      extraHtml: `Vous recevez cet email car vous avez activé les alertes email Radar CRM sur Lotexpo.`,
    },
  });

  const text = [
    'Lotexpo · Radar CRM',
    copy.title,
    '',
    args.eventName,
    '',
    args.message,
    '',
    `${copy.ctaLabel} : ${ctaUrl}`,
    '',
    'Vous recevez cet email car vous avez activé les alertes email Radar CRM sur Lotexpo.',
    `Se désabonner : ${unsubscribeUrl}`,
  ].join('\n');

  return { html, text, subject: copy.subject };
}

function eventNameOf(n: NotificationRow): string {
  const fromMeta = n.metadata && typeof n.metadata['eventName'] === 'string'
    ? String(n.metadata['eventName']).trim()
    : '';
  return fromMeta || 'votre salon';
}

function absoluteCtaUrl(appBaseUrl: string, linkUrl: string | null): string {
  const path = (linkUrl ?? '/radar-crm').trim();
  if (/^https?:\/\//i.test(path)) return path;
  return `${appBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function loadCandidateNotifications(
  supabase: ReturnType<typeof createClient>,
  filterUserId: string | null,
): Promise<NotificationRow[]> {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('notifications')
    .select('id, user_id, type, event_id, title, message, link_url, metadata, created_at')
    .in('type', SALON_TYPES as unknown as string[])
    .gte('created_at', twoDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (filterUserId) query = query.eq('user_id', filterUserId);
  const { data, error } = await query;
  if (error) throw new Error(`notifications: ${error.message}`);
  const rows = (data ?? []) as NotificationRow[];
  // Exclude test notifications (metadata.test === 'true' or true).
  return rows.filter((n) => {
    const t = n.metadata?.['test'];
    return String(t) !== 'true';
  });
}

// opt-in map: user_id -> allowed?
async function loadOptInMap(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<Set<string>> {
  const allowed = new Set<string>();
  if (userIds.length === 0) return allowed;
  const { data, error } = await supabase
    .from('crm_notification_preferences')
    .select('user_id, radar_email_enabled, radar_email_unsubscribed_at')
    .in('user_id', userIds);
  if (error) throw new Error(`preferences: ${error.message}`);
  for (const row of data ?? []) {
    const r = row as { user_id: string; radar_email_enabled: boolean | null; radar_email_unsubscribed_at: string | null };
    if (r.radar_email_enabled === true && !r.radar_email_unsubscribed_at) allowed.add(r.user_id);
  }
  return allowed;
}

// Already-sent notification ids (dry_run=false, status='sent').
async function loadAlreadySent(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<Set<string>> {
  const sent = new Set<string>();
  if (userIds.length === 0) return sent;
  const { data, error } = await supabase
    .from('radar_email_log')
    .select('notification_ids')
    .in('user_id', userIds)
    .eq('dry_run', false)
    .eq('status', 'sent')
    .in('email_type', SALON_TYPES as unknown as string[]);
  if (error) throw new Error(`already-sent: ${error.message}`);
  for (const row of data ?? []) {
    const ids = (row as { notification_ids?: string[] }).notification_ids ?? [];
    for (const id of ids) sent.add(id);
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResp({ success: false, error: 'Method not allowed' }, 405);

  const auth = await authorizeRequest(req);
  if (!auth.ok) return jsonResp({ success: false, error: auth.error }, auth.status);

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const dryRun = payload.dryRun !== false; // default true
  const sendReal = payload.sendReal === true;
  const userId = typeof payload.userId === 'string' && payload.userId ? payload.userId : null;

  // Real send requires explicit sendReal=true + dryRun=false.
  const realSend = sendReal && !dryRun;
  if (realSend && !userId && auth.mode !== 'service_role') {
    return jsonResp({ success: false, error: 'Batch real send requires service_role' }, 403);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://lotexpo.com';

  try {
    const candidates = await loadCandidateNotifications(supabase, userId);
    const userIds = Array.from(new Set(candidates.map((n) => n.user_id)));
    const [optIn, alreadySent] = await Promise.all([
      loadOptInMap(supabase, userIds),
      loadAlreadySent(supabase, userIds),
    ]);

    let usersScannedSet = new Set<string>();
    let skippedOptOut = 0;
    let skippedAlreadySent = 0;
    const errors: Array<{ notificationId: string; error: string }> = [];
    const previews: Array<{ userId: string; type: SalonType; subject: string; emailTo: string | null; notificationId: string; eventName: string }> = [];
    let emailsSent = 0;

    // Cache user email lookups.
    const emailCache = new Map<string, string | null>();
    async function resolveEmail(uid: string): Promise<string | null> {
      if (emailCache.has(uid)) return emailCache.get(uid)!;
      const { data } = await supabase.auth.admin.getUserById(uid);
      const email = data?.user?.email ?? null;
      emailCache.set(uid, email);
      return email;
    }

    for (const n of candidates) {
      usersScannedSet.add(n.user_id);
      if (!optIn.has(n.user_id)) { skippedOptOut++; continue; }
      if (alreadySent.has(n.id)) { skippedAlreadySent++; continue; }

      const eventName = eventNameOf(n);
      const copy = copyFor(n.type, eventName);

      if (!realSend) {
        const emailTo = await resolveEmail(n.user_id);
        previews.push({
          userId: n.user_id, type: n.type, subject: copy.subject,
          emailTo, notificationId: n.id, eventName,
        });
        continue;
      }

      // Real send.
      const emailTo = await resolveEmail(n.user_id);
      if (!emailTo) { errors.push({ notificationId: n.id, error: 'no email' }); continue; }

      // Guard against double-send within the same run.
      if (alreadySent.has(n.id)) { skippedAlreadySent++; continue; }

      const { data: logRow, error: logErr } = await supabase
        .from('radar_email_log')
        .insert({
          user_id: n.user_id,
          status: 'pending',
          dry_run: false,
          email_to: emailTo,
          email_subject: copy.subject,
          email_type: n.type,
          visibility_mode: 'full',
          notification_ids: [n.id],
          event_ids: n.event_id ? [n.event_id] : [],
          import_ids: [],
          events_count: n.event_id ? 1 : 0,
          companies_count: 0,
          metadata: { eventName, notificationType: n.type },
        })
        .select('id').single();
      if (logErr || !logRow) {
        errors.push({ notificationId: n.id, error: `log insert: ${logErr?.message ?? 'unknown'}` });
        continue;
      }
      const logId = (logRow as { id: string }).id;

      let unsubscribeUrl = '';
      try { unsubscribeUrl = await ensureUnsubscribeUrl(supabase, n.user_id); }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from('radar_email_log').update({ status: 'failed', error_message: msg.slice(0, 1000) }).eq('id', logId);
        errors.push({ notificationId: n.id, error: msg });
        continue;
      }

      const ctaUrl = absoluteCtaUrl(appBaseUrl, n.link_url);
      const { html, text, subject } = renderSalonEmail({
        type: n.type,
        eventName,
        message: n.message ?? copy.title,
        ctaUrl,
        unsubscribeUrl,
      });

      try {
        const { id: resendId } = await sendResendEmail({
          to: emailTo,
          subject,
          html, text,
          tags: [
            { name: 'feature', value: 'radar_crm' },
            { name: 'email_type', value: n.type },
            { name: 'environment', value: 'beta' },
          ],
        });
        const nowIso = new Date().toISOString();
        await supabase.from('radar_email_log').update({
          status: 'sent', sent_at: nowIso, resend_message_id: resendId,
        }).eq('id', logId);
        alreadySent.add(n.id);
        emailsSent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('resend send failed', { userId: n.user_id, notificationId: n.id, message: msg });
        await supabase.from('radar_email_log').update({ status: 'failed', error_message: msg.slice(0, 1000) }).eq('id', logId);
        errors.push({ notificationId: n.id, error: msg });
      }
    }

    const summary = {
      success: true,
      dryRun: !realSend,
      sendReal: realSend,
      mode: auth.mode,
      usersScanned: usersScannedSet.size,
      notificationsScanned: candidates.length,
      skipped: {
        optOut: skippedOptOut,
        alreadySent: skippedAlreadySent,
      },
      errors,
      ...(realSend
        ? { emailsSent }
        : { emailsWouldSend: previews.length, preview: previews }),
    };
    return jsonResp(summary, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('radar-crm-salon-notifier error', msg);
    return jsonResp({ success: false, error: msg }, 500);
  }
});