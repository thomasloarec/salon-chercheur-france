// Radar CRM email dispatcher — DRY-RUN ONLY in this MVP step.
//
// Builds a preview of the digest emails that WOULD be sent to users based on
// their unread Radar CRM notifications and their email preferences. Does NOT
// call Resend. Does NOT write to radar_email_log. Does NOT mutate any other
// table.
//
// Auth: same dual-mode as radar-crm-rematch-cron (service role OR admin JWT).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };

  if (timingSafeEqual(token, serviceRoleKey)) {
    return { ok: true, mode: 'service_role' };
  }

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

interface NotificationRow {
  id: string;
  user_id: string;
  event_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);

  const auth = await authorizeRequest(req);
  if (!auth.ok) {
    console.warn('radar-crm-email-dispatcher: rejected', { status: auth.status });
    return jsonResp({ error: auth.error }, auth.status);
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { /* empty body allowed */ }

  // Reject real-send attempts in this MVP step.
  const dryRun: boolean = payload?.dryRun !== false; // default true
  const sendReal: boolean = payload?.sendReal === true;
  if (!dryRun || sendReal) {
    return jsonResp({ success: false, error: 'Real email sending is not enabled yet.' }, 400);
  }

  const maxUsers: number = Math.min(Math.max(1, Number(payload?.maxUsers) || 50), 500);
  const maxEmailsPerRun: number = Math.min(Math.max(1, Number(payload?.maxEmailsPerRun) || maxUsers), 500);
  const filterUserId: string | null = typeof payload?.userId === 'string' && payload.userId ? payload.userId : null;
  const overrideLookahead: number | null = Number.isFinite(payload?.lookaheadDays) ? Number(payload.lookaheadDays) : null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1. Load preferences for users with email enabled and not unsubscribed.
  let prefsQuery = supabase
    .from('crm_notification_preferences')
    .select('user_id, radar_email_enabled, radar_email_unsubscribed_at, preferred_alert_timing_days, max_emails_per_week')
    .eq('radar_email_enabled', true)
    .is('radar_email_unsubscribed_at', null)
    .limit(maxUsers);
  if (filterUserId) prefsQuery = prefsQuery.eq('user_id', filterUserId);

  const { data: prefsRows, error: prefsErr } = await prefsQuery;
  if (prefsErr) {
    console.error('prefs load failed', prefsErr);
    return jsonResp({ success: false, error: prefsErr.message }, 500);
  }

  // usersScanned = total users we look at (even if filtered out below). If a
  // filterUserId is provided we always count 1 scanned for clarity.
  const usersScanned = filterUserId ? 1 : (prefsRows ?? []).length;

  let skippedUsersPreferences = 0;
  let skippedUsersQuota = 0;
  let skippedNotificationsAlreadyEmailed = 0;
  let notificationsIncluded = 0;
  let usersEligible = 0;
  const previews: Array<Record<string, unknown>> = [];
  const errors: Array<{ userId: string; message: string }> = [];

  // If filterUserId was given but no preference row matched (e.g. email
  // disabled), we surface that explicitly as a "skipped by preferences".
  if (filterUserId && (prefsRows ?? []).length === 0) {
    skippedUsersPreferences += 1;
  }

  for (const pref of prefsRows ?? []) {
    if (previews.length >= maxEmailsPerRun) break;
    const userId = pref.user_id as string;
    try {
      const timingDays = overrideLookahead ?? Number(pref.preferred_alert_timing_days) ?? 14;
      const maxPerWeek = Number(pref.max_emails_per_week) ?? 2;

      // Quota check — count REAL emails sent in the last 7 days.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: sentCount, error: countErr } = await supabase
        .from('radar_email_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('dry_run', false)
        .eq('status', 'sent')
        .gte('sent_at', sevenDaysAgo);
      if (countErr) throw new Error(`quota count: ${countErr.message}`);
      if ((sentCount ?? 0) >= maxPerWeek) {
        skippedUsersQuota += 1;
        continue;
      }

      // Load this user's Radar CRM notifications.
      const { data: notifs, error: nErr } = await supabase
        .from('notifications')
        .select('id, user_id, event_id, created_at, metadata')
        .eq('user_id', userId)
        .eq('type', 'radar_new_matches')
        .eq('category', 'radar_crm')
        .order('created_at', { ascending: false })
        .limit(200);
      if (nErr) throw new Error(`notifications: ${nErr.message}`);

      const candidateNotifs = (notifs ?? []) as NotificationRow[];
      if (candidateNotifs.length === 0) {
        skippedUsersPreferences += 0; // user simply has nothing
        continue;
      }

      // Already-emailed exclusion: any notification id present in a REAL
      // (dry_run=false) radar_email_log of status sent for this user.
      const { data: alreadyLogs, error: logsErr } = await supabase
        .from('radar_email_log')
        .select('notification_ids')
        .eq('user_id', userId)
        .eq('dry_run', false)
        .eq('status', 'sent');
      if (logsErr) throw new Error(`already-emailed: ${logsErr.message}`);
      const alreadyEmailed = new Set<string>();
      for (const row of alreadyLogs ?? []) {
        const ids = (row as { notification_ids?: string[] }).notification_ids ?? [];
        for (const id of ids) alreadyEmailed.add(id);
      }

      // Build event candidates within timing window.
      const eventIds = Array.from(
        new Set(candidateNotifs.map((n) => n.event_id).filter((v): v is string => Boolean(v))),
      );
      let eventMap = new Map<string, any>();
      if (eventIds.length > 0) {
        const { data: eventRows } = await supabase
          .from('events')
          .select('id, nom_event, slug, date_debut, ville, nom_lieu')
          .in('id', eventIds);
        eventMap = new Map((eventRows ?? []).map((e: any) => [e.id, e]));
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const minDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const maxDate = new Date(today.getTime() + timingDays * 24 * 60 * 60 * 1000);

      type Candidate = {
        notification: NotificationRow;
        event: any;
        companies: any[];
      };
      const candidates: Candidate[] = [];
      for (const n of candidateNotifs) {
        if (alreadyEmailed.has(n.id)) {
          skippedNotificationsAlreadyEmailed += 1;
          continue;
        }
        if (!n.event_id) continue;
        const ev = eventMap.get(n.event_id);
        if (!ev || !ev.date_debut) continue;
        const evDate = new Date(`${ev.date_debut}T00:00:00Z`);
        if (evDate < minDate || evDate > maxDate) continue;
        const meta = (n.metadata ?? {}) as Record<string, unknown>;
        const companies = Array.isArray(meta.companies) ? (meta.companies as any[]) : [];
        candidates.push({ notification: n, event: ev, companies });
      }

      if (candidates.length === 0) continue;

      // Sort: nearest first, then most companies.
      candidates.sort((a, b) => {
        const da = new Date(a.event.date_debut).getTime();
        const db = new Date(b.event.date_debut).getTime();
        if (da !== db) return da - db;
        return (b.companies.length) - (a.companies.length);
      });

      const top = candidates.slice(0, 5);
      usersEligible += 1;
      notificationsIncluded += top.length;

      // Fetch user email (auth.users via admin API).
      let emailTo: string | null = null;
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        emailTo = userData?.user?.email ?? null;
      } catch (_) { /* ignore */ }

      const allCompanies = new Set<string>();
      for (const c of top) for (const co of c.companies) {
        if (co?.crmCompanyId) allCompanies.add(String(co.crmCompanyId));
      }

      const subject = top.length === 1
        ? `Une entreprise de votre Radar CRM expose à ${top[0].event.nom_event ?? 'un salon'}`
        : `${top.length} salons à venir avec des entreprises de votre Radar CRM`;

      previews.push({
        userId,
        emailTo,
        subject,
        eventsCount: top.length,
        companiesCount: allCompanies.size,
        notifications: top.map((c) => ({
          notificationId: c.notification.id,
          eventId: c.event.id,
          eventName: c.event.nom_event,
          eventDate: c.event.date_debut,
          eventCity: c.event.ville,
          eventVenue: c.event.nom_lieu,
          eventSlug: c.event.slug,
          companies: c.companies.map((co: any) => ({
            crmCompanyId: co.crmCompanyId ?? null,
            companyName: co.companyName ?? null,
            stand: co.stand ?? null,
          })),
        })),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('preview user failed', { userId, message });
      errors.push({ userId, message });
    }
  }

  const resp = {
    success: true,
    dryRun: true,
    usersScanned,
    usersEligible,
    emailsWouldSend: previews.length,
    notificationsIncluded,
    skippedUsersPreferences,
    skippedUsersQuota,
    skippedNotificationsAlreadyEmailed,
    previews,
    errors,
  };
  return jsonResp(resp);
});