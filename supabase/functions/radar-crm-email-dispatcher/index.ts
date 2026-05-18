// Radar CRM email dispatcher.
//
// Modes:
//   - dryRun=true (default): preview-only, no Resend call, no DB writes.
//   - sendReal=true + dryRun=false + userId: Beta manual single-user real send
//       (admin JWT or service_role).
//   - sendReal=true + dryRun=false + no userId: Beta batch real send
//       (service_role ONLY — admins are refused with 403).
//
// Real-send safeguards:
//   - manual mode: caller is admin or service_role; userId is REQUIRED.
//   - batch mode: caller MUST be service_role; userId is optional.
//   - users included must have radar_email_enabled=true and not unsubscribed.
//   - weekly quota (max_emails_per_week) is enforced.
//   - notification ids already present in a previous sent log are skipped.
//   - capped by maxUsers and maxEmailsPerRun per invocation.
//   - radar-crm-rematch-cron, crm_run_matching, internal notifications are
//     not touched.
//
// No email cron is created. Real sends are strictly opt-in per call.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { sendResendEmail } from '../_shared/resend.ts';

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

interface NotificationRow {
  id: string;
  user_id: string;
  event_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

function normalizeCompanyName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function companyKey(co: any): string | null {
  if (co?.crmCompanyId) return `id:${String(co.crmCompanyId)}`;
  if (co?.companyName) return `n:${normalizeCompanyName(String(co.companyName))}`;
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return iso; }
}

function faviconUrl(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const d = String(domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!d) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`;
}

function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0]!.toUpperCase()).join('');
}

type GroupedEvent = {
  eventId: string;
  event: any;
  notificationIds: string[];
  importIds: string[];
  companies: any[];
  mergedCount: number;
  latestCreatedAt: string;
};

type PreviewBuild = {
  userId: string;
  emailTo: string | null;
  subject: string;
  eventsCount: number;
  companiesCount: number;
  notificationIds: string[];
  eventIds: string[];
  importIds: string[];
  groups: GroupedEvent[];
};

type SkipReason = 'preferences' | 'quota' | 'no_notifications' | 'no_eligible' | 'all_already_emailed';

async function buildPreviewForUser(
  supabase: ReturnType<typeof createClient>,
  pref: any,
  overrideLookahead: number | null,
): Promise<{ preview: PreviewBuild | null; skip?: SkipReason; alreadyEmailedCount: number }> {
  const userId = pref.user_id as string;
  const timingDays = overrideLookahead ?? Number(pref.preferred_alert_timing_days) ?? 14;
  const maxPerWeek = Number(pref.max_emails_per_week) ?? 2;

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
    return { preview: null, skip: 'quota', alreadyEmailedCount: 0 };
  }

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
    return { preview: null, skip: 'no_notifications', alreadyEmailedCount: 0 };
  }

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

  const eventIds = Array.from(new Set(candidateNotifs.map((n) => n.event_id).filter((v): v is string => Boolean(v))));
  let eventMap = new Map<string, any>();
  if (eventIds.length > 0) {
    const { data: eventRows } = await supabase
      .from('events').select('id, nom_event, slug, date_debut, ville, nom_lieu, url_image').in('id', eventIds);
    eventMap = new Map((eventRows ?? []).map((e: any) => [e.id, e]));
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const minDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const maxDate = new Date(today.getTime() + timingDays * 24 * 60 * 60 * 1000);

  let alreadyEmailedCount = 0;
  const candidates: Array<{ notification: NotificationRow; event: any; companies: any[] }> = [];
  for (const n of candidateNotifs) {
    if (alreadyEmailed.has(n.id)) { alreadyEmailedCount += 1; continue; }
    if (!n.event_id) continue;
    const ev = eventMap.get(n.event_id);
    if (!ev || !ev.date_debut) continue;
    const evDate = new Date(`${ev.date_debut}T00:00:00Z`);
    if (evDate < minDate || evDate > maxDate) continue;
    const meta = (n.metadata ?? {}) as Record<string, unknown>;
    const companies = Array.isArray(meta.companies) ? (meta.companies as any[]) : [];
    candidates.push({ notification: n, event: ev, companies });
  }

  if (candidates.length === 0) {
    const skip: SkipReason = alreadyEmailedCount > 0 ? 'all_already_emailed' : 'no_eligible';
    return { preview: null, skip, alreadyEmailedCount };
  }

  const groupedMap = new Map<string, GroupedEvent>();
  for (const c of candidates) {
    const eid = c.event.id as string;
    const meta = (c.notification.metadata ?? {}) as Record<string, unknown>;
    const importId =
      (typeof meta.importId === 'string' && meta.importId) ||
      (typeof meta.import_id === 'string' && meta.import_id) ||
      null;
    let g = groupedMap.get(eid);
    if (!g) {
      g = { eventId: eid, event: c.event, notificationIds: [], importIds: [], companies: [], mergedCount: 0, latestCreatedAt: c.notification.created_at };
      groupedMap.set(eid, g);
    }
    g.notificationIds.push(c.notification.id);
    g.mergedCount += 1;
    if (importId && !g.importIds.includes(importId)) g.importIds.push(importId);
    if (new Date(c.notification.created_at) > new Date(g.latestCreatedAt)) {
      g.latestCreatedAt = c.notification.created_at;
      g.event = c.event;
    }
    for (const co of c.companies) {
      const key = companyKey(co); if (!key) continue;
      if (g.companies.some((x) => companyKey(x) === key)) continue;
      g.companies.push(co);
    }
  }

  const groupedList = Array.from(groupedMap.values());
  groupedList.sort((a, b) => {
    const da = new Date(a.event.date_debut).getTime();
    const db = new Date(b.event.date_debut).getTime();
    if (da !== db) return da - db;
    return b.companies.length - a.companies.length;
  });
  const top = groupedList.slice(0, 5);

  // Exclude companies whose underlying match is flagged needs_review.
  // Automatic Radar CRM emails never include suspicious matches.
  try {
    const eventIdsForFilter = top.map((g) => g.eventId);
    const crmCompanyIdsForFilter = Array.from(new Set(
      top.flatMap((g) => g.companies.map((c: any) => c.crmCompanyId).filter(Boolean)),
    )) as string[];
    if (eventIdsForFilter.length > 0 && crmCompanyIdsForFilter.length > 0) {
      const { data: flagged } = await supabase
        .from('crm_company_event_matches')
        .select('event_id, crm_company_id')
        .eq('user_id', userId)
        .eq('needs_review', true)
        .in('event_id', eventIdsForFilter)
        .in('crm_company_id', crmCompanyIdsForFilter);
      const flaggedKeys = new Set<string>(
        (flagged ?? []).map((r: any) => `${r.event_id}|${r.crm_company_id}`),
      );
      if (flaggedKeys.size > 0) {
        for (const g of top) {
          g.companies = g.companies.filter(
            (c: any) => !c.crmCompanyId || !flaggedKeys.has(`${g.eventId}|${c.crmCompanyId}`),
          );
        }
      }
    }
  } catch (_) {
    // Best-effort: do not let a filter error block legitimate sends.
  }

  // Drop groups that became empty after the needs_review filter.
  const filteredTop = top.filter((g) => g.companies.length > 0);
  if (filteredTop.length === 0) {
    const skip: SkipReason = alreadyEmailedCount > 0 ? 'all_already_emailed' : 'no_eligible';
    return { preview: null, skip, alreadyEmailedCount };
  }
  top.length = 0;
  top.push(...filteredTop);

  // Enrich companies with normalized_domain from crm_companies for favicon rendering.
  const allCrmCompanyIds = Array.from(new Set(
    top.flatMap((g) => g.companies.map((c: any) => c.crmCompanyId).filter(Boolean)),
  )) as string[];
  if (allCrmCompanyIds.length > 0) {
    try {
      const { data: crmRows } = await supabase
        .from('crm_companies')
        .select('id, normalized_domain, website_raw, company_name')
        .in('id', allCrmCompanyIds);
      const domainMap = new Map<string, { domain: string | null; website: string | null }>();
      for (const r of crmRows ?? []) {
        domainMap.set((r as any).id, {
          domain: (r as any).normalized_domain ?? null,
          website: (r as any).website_raw ?? null,
        });
      }
      for (const g of top) {
        for (const co of g.companies as any[]) {
          const info = co.crmCompanyId ? domainMap.get(co.crmCompanyId) : null;
          if (info) {
            co.normalizedDomain = info.domain;
            co.website = info.website;
          }
        }
      }
    } catch (_) { /* favicons are best-effort */ }
  }

  let emailTo: string | null = null;
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    emailTo = userData?.user?.email ?? null;
  } catch (_) { /* ignore */ }

  const companyKeys = new Set<string>();
  for (const g of top) for (const co of g.companies) {
    const k = companyKey(co); if (k) companyKeys.add(k);
  }
  const companiesCount = companyKeys.size;
  const eventsCount = top.length;

  // Smart subject line — fall back to generic if names would be too long.
  const SUBJECT_MAX = 90;
  const firstCompanyName: string | null = (() => {
    for (const g of top) for (const co of g.companies as any[]) {
      if (co?.companyName) return String(co.companyName);
    }
    return null;
  })();
  const firstEventName: string | null = top[0]?.event?.nom_event ? String(top[0].event.nom_event) : null;
  let subject: string;
  if (companiesCount === 1 && eventsCount === 1 && firstCompanyName && firstEventName) {
    subject = `${firstCompanyName} expose bientôt à ${firstEventName}`;
  } else if (companiesCount === 1 && eventsCount > 1 && firstCompanyName) {
    subject = `${firstCompanyName} expose bientôt sur ${eventsCount} salons`;
  } else if (companiesCount > 1 && eventsCount === 1 && firstEventName) {
    subject = `${companiesCount} entreprises de votre Radar CRM exposent à ${firstEventName}`;
  } else if (companiesCount > 1) {
    subject = `${companiesCount} entreprises de votre Radar CRM exposent bientôt sur ${eventsCount} salons`;
  } else {
    subject = `1 entreprise de votre Radar CRM expose bientôt`;
  }
  if (subject.length > SUBJECT_MAX) {
    subject = companiesCount === 1
      ? `1 entreprise de votre Radar CRM expose bientôt`
      : `${companiesCount} entreprises de votre Radar CRM exposent bientôt`;
  }

  const notificationIds = top.flatMap((g) => g.notificationIds);
  const importIds = Array.from(new Set(top.flatMap((g) => g.importIds)));
  const eventIdsOut = top.map((g) => g.eventId);

  return {
    preview: {
      userId, emailTo, subject,
      eventsCount, companiesCount,
      notificationIds, eventIds: eventIdsOut, importIds,
      groups: top,
    },
    alreadyEmailedCount,
  };
}

function previewToJson(p: PreviewBuild) {
  return {
    userId: p.userId,
    emailTo: p.emailTo,
    subject: p.subject,
    eventsCount: p.eventsCount,
    companiesCount: p.companiesCount,
    notifications: p.groups.map((g) => ({
      notificationId: g.notificationIds[0],
      notificationIds: g.notificationIds,
      mergedNotificationsCount: g.mergedCount,
      importIds: g.importIds,
      eventId: g.event.id,
      eventName: g.event.nom_event,
      eventDate: g.event.date_debut,
      eventCity: g.event.ville,
      eventVenue: g.event.nom_lieu,
      eventSlug: g.event.slug,
      eventImage: g.event.url_image ?? null,
      companies: g.companies.map((co: any) => ({
        crmCompanyId: co.crmCompanyId ?? null,
        companyName: co.companyName ?? null,
        stand: co.stand ?? null,
        normalizedDomain: co.normalizedDomain ?? null,
      })),
    })),
  };
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

function renderEmail(p: PreviewBuild, unsubscribeUrl: string, appBaseUrl: string) {
  const ORANGE = '#ff7a1f';
  const ORANGE_DARK = '#ea6a10';
  const ORANGE_SOFT = '#fff4ec';
  const NAVY = '#06286e';
  const TEXT = '#0f172a';
  const MUTED = '#64748b';
  const BORDER = '#e5e7eb';
  const BG = '#f5f7fb';

  const totalCompanies = p.companiesCount;
  const totalEvents = p.eventsCount;

  const eventsHtml = p.groups.map((g) => {
    const eventLink = `${appBaseUrl}/radar-crm/results?eventId=${g.eventId}`;
    const evName = escapeHtml(String(g.event.nom_event ?? '—'));
    const evDate = escapeHtml(formatDateFr(g.event.date_debut));
    const evCity = g.event.ville ? escapeHtml(String(g.event.ville)) : '';
    const evVenue = g.event.nom_lieu ? escapeHtml(String(g.event.nom_lieu)) : '';
    const imgUrl = g.event.url_image ? String(g.event.url_image) : null;

    const IMG_H = 180;
    const heroImage = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" alt="${evName}" width="568" height="${IMG_H}" class="rcrm-hero" style="display:block;width:100%;max-width:100%;height:${IMG_H}px;object-fit:cover;border-radius:10px 10px 0 0;border:0;outline:none;" />`
      : `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="rcrm-hero-wrap" style="width:100%;height:${IMG_H}px;background:${ORANGE_SOFT};border-radius:10px 10px 0 0;border-bottom:1px solid ${BORDER};"><tr><td align="center" valign="middle" class="rcrm-hero" style="padding:16px;color:${ORANGE_DARK};font-weight:700;font-size:14px;letter-spacing:.04em;text-transform:uppercase;line-height:1.3;word-break:break-word;">${evName}</td></tr></table>`;

    const companiesTitle = g.companies.length > 1
      ? 'Entreprises détectées dans votre CRM'
      : 'Entreprise détectée dans votre CRM';

    const companiesChips = g.companies.map((co: any) => {
      const name = escapeHtml(String(co.companyName ?? '—'));
      const fav = faviconUrl(co.normalizedDomain);
      const standTxt = co.stand ? `Stand ${escapeHtml(String(co.stand))}` : '';
      const domainTxt = co.normalizedDomain ? escapeHtml(String(co.normalizedDomain)) : '';
      const subParts = [domainTxt, standTxt].filter(Boolean).join(' · ');
      const subLine = subParts ? `<div style="font-size:12px;color:${MUTED};margin-top:2px;word-break:break-word;">${subParts}</div>` : '';
      const logoCell = fav
        ? `<img src="${escapeHtml(fav)}" alt="${name}" width="32" height="32" style="display:block;width:32px;height:32px;border-radius:6px;border:1px solid ${BORDER};background:#fff;object-fit:contain;" />`
        : `<div style="width:32px;height:32px;border-radius:6px;background:${ORANGE};color:#fff;font-weight:700;font-size:13px;line-height:32px;text-align:center;">${escapeHtml(companyInitials(String(co.companyName ?? '?')))}</div>`;
      return `
        <tr><td style="padding:6px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#fff;border:1px solid ${BORDER};border-radius:10px;">
            <tr>
              <td width="44" style="padding:10px 0 10px 12px;vertical-align:top;">${logoCell}</td>
              <td style="padding:10px 12px;vertical-align:top;">
                <div style="font-size:14px;font-weight:700;color:${TEXT};word-break:break-word;line-height:1.3;">${name}</div>
                ${subLine}
                <div style="margin-top:6px;"><span style="display:inline-block;padding:3px 8px;background:${ORANGE_SOFT};color:${ORANGE_DARK};border-radius:999px;font-size:11px;font-weight:600;">Présent dans votre CRM</span></div>
              </td>
            </tr>
          </table>
        </td></tr>`;
    }).join('');

    const contentBlock = `
      <span style="display:inline-block;padding:3px 10px;background:${ORANGE};color:#fff;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Opportunité Radar CRM</span>
      <h2 class="rcrm-event-title" style="font-size:20px;margin:10px 0 4px 0;color:${NAVY};line-height:1.3;word-break:break-word;">${evName}</h2>
      <div style="font-size:13px;color:${MUTED};margin-bottom:10px;line-height:1.5;word-break:break-word;">${evDate}${evCity ? ` · ${evCity}` : ''}${evVenue ? ` · ${evVenue}` : ''}</div>
      <div style="font-size:12px;font-weight:600;color:${NAVY};text-transform:uppercase;letter-spacing:.04em;margin:6px 0 4px 0;">${companiesTitle}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">${companiesChips}</table>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;margin-top:14px;"><tr><td align="center">
        <a href="${eventLink}" class="rcrm-cta" style="display:block;width:100%;max-width:100%;box-sizing:border-box;padding:12px 16px;background:${ORANGE};color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;text-align:center;">Voir cette opportunité →</a>
      </td></tr></table>`;

    return `
      <tr><td style="padding:0 0 16px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;background:#fff;border:1px solid ${BORDER};border-radius:12px;border-collapse:separate;">
          <tr><td style="padding:0;line-height:0;font-size:0;">${heroImage}</td></tr>
          <tr><td class="rcrm-card-cell" style="padding:18px;">${contentBlock}</td></tr>
        </table>
      </td></tr>`;
  }).join('');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /><title>${escapeHtml(p.subject)}</title>
<style>
  img{max-width:100% !important;height:auto;}
  table{border-collapse:collapse;}
  .rcrm-cta{mso-padding-alt:12px 16px;}
  @media only screen and (max-width:520px){
    .rcrm-container{width:100% !important;max-width:100% !important;padding:0 !important;}
    .rcrm-outer-cell{padding:12px 8px !important;}
    .rcrm-intro{padding:20px 16px !important;border-radius:12px !important;}
    .rcrm-intro h1{font-size:20px !important;}
    .rcrm-hero{height:160px !important;}
    .rcrm-card-cell{padding:14px !important;}
    .rcrm-event-title{font-size:18px !important;}
    .rcrm-final-cta{display:block !important;width:100% !important;box-sizing:border-box !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${totalCompanies} entreprise${totalCompanies>1?'s':''} de votre CRM exposent sur ${totalEvents} salon${totalEvents>1?'s':''}. Préparez vos rendez-vous.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};width:100%;">
    <tr><td align="center" class="rcrm-outer-cell" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="rcrm-container" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 4px 18px 4px;">
          <table role="presentation" width="100%"><tr>
            <td style="font-size:20px;font-weight:700;color:${ORANGE};letter-spacing:-0.01em;">Lotexpo</td>
            <td style="text-align:right;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Radar CRM</td>
          </tr></table>
        </td></tr>

        <tr><td class="rcrm-intro" style="background:#fff;border:1px solid ${BORDER};border-radius:14px;padding:28px 24px;">
          <h1 style="font-size:22px;line-height:1.3;margin:0 0 10px 0;color:${NAVY};word-break:break-word;">De nouvelles opportunités salon détectées</h1>
          <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 16px 0;">
            Radar CRM a détecté que des entreprises présentes dans votre fichier CRM exposent prochainement sur des salons référencés par Lotexpo.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ORANGE_SOFT};border-radius:10px;margin-bottom:8px;">
            <tr>
              <td style="padding:14px 16px;font-size:13px;color:${NAVY};">
                <strong style="color:${ORANGE_DARK};">${totalCompanies}</strong> entreprise${totalCompanies>1?'s':''} de votre CRM ·
                <strong style="color:${ORANGE_DARK};">${totalEvents}</strong> salon${totalEvents>1?'s':''}<br/>
                <span style="color:${MUTED};">Préparez vos rendez-vous avant l’événement.</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:20px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${eventsHtml}</table>
        </td></tr>

        <tr><td style="text-align:center;padding:8px 0 24px 0;">
          <a href="${appBaseUrl}/radar-crm" class="rcrm-final-cta" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:14px 26px;background:${ORANGE};color:#fff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;text-align:center;">Voir toutes mes opportunités Radar CRM</a>
        </td></tr>

        <tr><td style="padding:8px 12px 24px 12px;">
          <p style="font-size:12px;color:${MUTED};line-height:1.6;margin:0 0 10px 0;text-align:center;">
            Ces informations sont basées sur les données de participation disponibles sur Lotexpo à la date d’envoi.
          </p>
          <p style="font-size:12px;color:${MUTED};line-height:1.6;margin:0;text-align:center;">
            Vous recevez cet email car vous avez activé les alertes email Radar CRM sur Lotexpo.<br/>
            <a href="${unsubscribeUrl}" style="color:${NAVY};text-decoration:underline;">Se désabonner des emails Radar CRM</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const textLines = [
    'Lotexpo · Radar CRM',
    'De nouvelles opportunités salon détectées',
    '',
    `${totalCompanies} entreprise${totalCompanies > 1 ? 's' : ''} de votre CRM · ${totalEvents} salon${totalEvents > 1 ? 's' : ''}`,
    'Préparez vos rendez-vous avant l’événement.',
    '',
    "Radar CRM a détecté que des entreprises présentes dans votre fichier CRM exposent prochainement sur des salons référencés par Lotexpo.",
    '',
  ];
  for (const g of p.groups) {
    textLines.push(`▶ ${g.event.nom_event ?? '—'}`);
    textLines.push(`  ${formatDateFr(g.event.date_debut)} · ${g.event.ville ?? '—'}${g.event.nom_lieu ? ` · ${g.event.nom_lieu}` : ''}`);
    const label = g.companies.length > 1 ? 'Entreprises détectées dans votre CRM' : 'Entreprise détectée dans votre CRM';
    textLines.push(`  ${label} :`);
    for (const co of g.companies as any[]) {
      const parts = [String(co.companyName ?? '—')];
      if (co.stand) parts.push(`stand ${co.stand}`);
      if (co.normalizedDomain) parts.push(co.normalizedDomain);
      textLines.push(`    • ${parts.join(' · ')}`);
    }
    textLines.push(`  Voir cette opportunité : ${appBaseUrl}/radar-crm/results?eventId=${g.eventId}`);
    textLines.push('');
  }
  textLines.push(`Voir toutes mes opportunités Radar CRM : ${appBaseUrl}/radar-crm`);
  textLines.push('');
  textLines.push("Ces informations sont basées sur les données de participation disponibles sur Lotexpo à la date d'envoi.");
  textLines.push('Vous recevez cet email car vous avez activé les alertes email Radar CRM sur Lotexpo.');
  textLines.push(`Se désabonner : ${unsubscribeUrl}`);

  return { html, text: textLines.join('\n') };
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

  const sendReal: boolean = payload?.sendReal === true;
  const dryRun: boolean = sendReal ? payload?.dryRun === true : payload?.dryRun !== false;
  const filterUserId: string | null = typeof payload?.userId === 'string' && payload.userId ? payload.userId : null;
  const overrideLookahead: number | null = Number.isFinite(payload?.lookaheadDays) ? Number(payload.lookaheadDays) : null;
  const source: string = typeof payload?.source === 'string' && payload.source
    ? payload.source
    : (auth.mode === 'service_role' ? 'cron' : 'manual_admin');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Helper: insert a system usage event (user_id = null). Best-effort.
  const trackSystem = async (eventType: string, metadata: Record<string, unknown>) => {
    try {
      await supabase.from('crm_usage_events').insert({
        user_id: null,
        event_type: eventType,
        metadata: { source: 'radar_email_system', dispatcher_source: source, ...metadata },
      });
    } catch (_) { /* tracking is best-effort */ }
  };

  // ----- REAL SEND PATHS -----
  if (sendReal) {
    if (dryRun) return jsonResp({ success: false, error: 'sendReal=true cannot be combined with dryRun=true' }, 400);

    // BATCH mode (no userId) — strictly service_role.
    if (!filterUserId) {
      if (auth.mode !== 'service_role') {
        return jsonResp({ success: false, error: 'Batch real email sending requires service_role.' }, 403);
      }
      return await runBatchRealSend(supabase, overrideLookahead, payload, source, trackSystem);
    }

    // MANUAL single-user mode — admin or service_role.
    return await runManualRealSend(supabase, filterUserId, overrideLookahead, source, trackSystem);
  }

  // ----- DRY-RUN PATH -----
  return await runDryRun(supabase, filterUserId, overrideLookahead, payload);
});

async function runManualRealSend(
  supabase: ReturnType<typeof createClient>,
  filterUserId: string,
  overrideLookahead: number | null,
  source: string,
  trackSystem: (e: string, m: Record<string, unknown>) => Promise<void>,
): Promise<Response> {
  await trackSystem('radar_email_dispatch_started', { sendReal: true, dryRun: false, mode: 'manual', userId: filterUserId });

    const { data: prefRow, error: prefErr } = await supabase
      .from('crm_notification_preferences')
      .select('user_id, radar_email_enabled, radar_email_unsubscribed_at, preferred_alert_timing_days, max_emails_per_week')
      .eq('user_id', filterUserId).maybeSingle();
    if (prefErr) return jsonResp({ success: false, error: prefErr.message }, 500);
    if (!prefRow || prefRow.radar_email_enabled !== true || prefRow.radar_email_unsubscribed_at !== null) {
      return jsonResp({ success: false, error: 'Radar email is not enabled for this user.' }, 400);
    }

  const r = await sendRealForUser(supabase, prefRow, overrideLookahead);
  await trackSystem('radar_email_dispatch_completed', {
    sendReal: true, dryRun: false, mode: 'manual',
    usersScanned: 1,
    usersEligible: r.outcome === 'sent' ? 1 : 0,
    emailsSent: r.outcome === 'sent' ? 1 : 0,
    emailsFailed: r.outcome === 'failed' ? 1 : 0,
    notificationsIncluded: r.notificationIdsIncluded?.length ?? 0,
    skippedNotificationsAlreadyEmailed: r.skippedNotificationsAlreadyEmailed ?? 0,
  });
  if (r.outcome === 'sent') {
    await trackSystem('radar_email_sent', { userId: filterUserId, logId: r.logId, resendMessageId: r.resendMessageId });
  } else if (r.outcome === 'failed') {
    await trackSystem('radar_email_failed', { userId: filterUserId, logId: r.logId, error: r.error });
  }
  return jsonResp(r.response, r.status);
}

async function runBatchRealSend(
  supabase: ReturnType<typeof createClient>,
  overrideLookahead: number | null,
  payload: any,
  source: string,
  trackSystem: (e: string, m: Record<string, unknown>) => Promise<void>,
): Promise<Response> {
  const maxUsers: number = Math.min(Math.max(1, Number(payload?.maxUsers) || 50), 500);
  const maxEmailsPerRun: number = Math.min(Math.max(1, Number(payload?.maxEmailsPerRun) || 20), 500);

  await trackSystem('radar_email_dispatch_started', { sendReal: true, dryRun: false, mode: 'batch', maxUsers, maxEmailsPerRun });

  const { data: prefsRows, error: prefsErr } = await supabase
    .from('crm_notification_preferences')
    .select('user_id, radar_email_enabled, radar_email_unsubscribed_at, preferred_alert_timing_days, max_emails_per_week')
    .eq('radar_email_enabled', true)
    .is('radar_email_unsubscribed_at', null)
    .limit(maxUsers);
  if (prefsErr) return jsonResp({ success: false, error: prefsErr.message }, 500);

  const usersScanned = (prefsRows ?? []).length;
  let usersEligible = 0;
  let emailsSent = 0;
  let emailsFailed = 0;
  let notificationsIncluded = 0;
  let skippedUsersPreferences = 0;
  let skippedUsersQuota = 0;
  let skippedNotificationsAlreadyEmailed = 0;
  const errors: Array<{ userId: string; message: string }> = [];
  const sent: Array<{ userId: string; emailTo: string | null; logId: string; resendMessageId: string }> = [];

  for (const pref of prefsRows ?? []) {
    if (emailsSent >= maxEmailsPerRun) break;
    const userId = pref.user_id as string;
    try {
      const r = await sendRealForUser(supabase, pref, overrideLookahead);
      skippedNotificationsAlreadyEmailed += r.skippedNotificationsAlreadyEmailed ?? 0;
      if (r.outcome === 'sent') {
        usersEligible += 1;
        emailsSent += 1;
        notificationsIncluded += r.notificationIdsIncluded?.length ?? 0;
        sent.push({ userId, emailTo: r.emailTo ?? null, logId: r.logId!, resendMessageId: r.resendMessageId! });
        await trackSystem('radar_email_sent', { userId, logId: r.logId, resendMessageId: r.resendMessageId });
      } else if (r.outcome === 'failed') {
        emailsFailed += 1;
        errors.push({ userId, message: r.error ?? 'unknown' });
        await trackSystem('radar_email_failed', { userId, logId: r.logId ?? null, error: r.error });
      } else if (r.outcome === 'skipped') {
        if (r.reason === 'quota') skippedUsersQuota += 1;
        else skippedUsersPreferences += 1;
      }
    } catch (e) {
      emailsFailed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ userId, message: msg });
      await trackSystem('radar_email_failed', { userId, error: msg });
    }
  }

  await trackSystem('radar_email_dispatch_completed', {
    sendReal: true, dryRun: false, mode: 'batch',
    usersScanned, usersEligible, emailsSent, emailsFailed,
    notificationsIncluded,
    skippedUsersPreferences, skippedUsersQuota,
    skippedNotificationsAlreadyEmailed,
    errorsCount: errors.length,
  });

  return jsonResp({
    success: true, dryRun: false, sendReal: true, mode: 'batch',
    usersScanned, usersEligible, emailsSent, emailsFailed,
    notificationsIncluded,
    skippedUsersPreferences, skippedUsersQuota,
    skippedNotificationsAlreadyEmailed,
    sent, errors,
  });
}

type RealSendResult = {
  outcome: 'sent' | 'skipped' | 'failed';
  status: number;
  response: Record<string, unknown>;
  reason?: string;
  logId?: string;
  resendMessageId?: string;
  emailTo?: string | null;
  notificationIdsIncluded?: string[];
  skippedNotificationsAlreadyEmailed?: number;
  error?: string;
};

async function sendRealForUser(
  supabase: ReturnType<typeof createClient>,
  prefRow: any,
  overrideLookahead: number | null,
): Promise<RealSendResult> {
  const filterUserId = prefRow.user_id as string;

  let built;
  try { built = await buildPreviewForUser(supabase, prefRow, overrideLookahead); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { outcome: 'failed', status: 500, response: { success: false, error: msg }, error: msg };
  }

  if (!built.preview) {
    return {
      outcome: 'skipped',
      status: 200,
      reason: built.skip,
      skippedNotificationsAlreadyEmailed: built.alreadyEmailedCount,
      response: {
        success: true, dryRun: false, sendReal: true,
        emailsSent: 0,
        reason: built.skip ?? 'no_eligible',
        skippedNotificationsAlreadyEmailed: built.alreadyEmailedCount,
      },
    };
  }

  const p = built.preview;
  if (!p.emailTo) {
    return {
      outcome: 'failed', status: 400,
      response: { success: false, error: 'No email address found for this user.' },
      error: 'no_email',
    };
  }

  const metadataLog = {
    events: p.groups.map((g) => ({
      eventId: g.eventId,
      eventName: g.event.nom_event,
      eventDate: g.event.date_debut,
      eventCity: g.event.ville,
      companies: g.companies.map((c: any) => ({ crmCompanyId: c.crmCompanyId ?? null, companyName: c.companyName ?? null })),
    })),
  };

  const { data: logRow, error: logErr } = await supabase
    .from('radar_email_log')
    .insert({
      user_id: filterUserId,
      status: 'pending',
      dry_run: false,
      email_to: p.emailTo,
      email_subject: p.subject,
      email_type: 'radar_digest',
      visibility_mode: 'full',
      notification_ids: p.notificationIds,
      event_ids: p.eventIds,
      import_ids: p.importIds,
      events_count: p.eventsCount,
      companies_count: p.companiesCount,
      metadata: metadataLog,
    })
    .select('id').single();
  if (logErr || !logRow) {
    const msg = `log insert: ${logErr?.message ?? 'unknown'}`;
    return { outcome: 'failed', status: 500, response: { success: false, error: msg }, error: msg };
  }
  const logId = (logRow as { id: string }).id;

  let unsubscribeUrl = '';
  try { unsubscribeUrl = await ensureUnsubscribeUrl(supabase, filterUserId); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from('radar_email_log').update({ status: 'failed', error_message: msg }).eq('id', logId);
    return { outcome: 'failed', status: 500, response: { success: false, error: msg }, error: msg, logId };
  }

  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://lotexpo.com';
  const { html, text } = renderEmail(p, unsubscribeUrl, appBaseUrl);

  try {
    const { id: resendId } = await sendResendEmail({
      to: p.emailTo,
      subject: p.subject,
      html, text,
      tags: [
        { name: 'feature', value: 'radar_crm' },
        { name: 'email_type', value: 'radar_digest' },
        { name: 'environment', value: 'beta' },
      ],
    });
    const nowIso = new Date().toISOString();
    await supabase.from('radar_email_log').update({
      status: 'sent', sent_at: nowIso, resend_message_id: resendId,
    }).eq('id', logId);
    await supabase.from('crm_notification_preferences').update({
      last_radar_email_sent_at: nowIso,
    }).eq('user_id', filterUserId);

    return {
      outcome: 'sent', status: 200,
      logId, resendMessageId: resendId, emailTo: p.emailTo,
      notificationIdsIncluded: p.notificationIds,
      skippedNotificationsAlreadyEmailed: built.alreadyEmailedCount,
      response: {
        success: true, dryRun: false, sendReal: true,
        emailsSent: 1,
        emailTo: p.emailTo, subject: p.subject,
        resendMessageId: resendId, status: 'sent', logId,
        notificationIdsIncluded: p.notificationIds,
        skippedNotificationsAlreadyEmailed: built.alreadyEmailedCount,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('resend send failed', { userId: filterUserId, message: msg });
    await supabase.from('radar_email_log').update({ status: 'failed', error_message: msg.slice(0, 1000) }).eq('id', logId);
    return {
      outcome: 'failed', status: 500,
      response: { success: false, error: msg, status: 'failed', logId },
      error: msg, logId,
    };
  }
}

async function runDryRun(
  supabase: ReturnType<typeof createClient>,
  filterUserId: string | null,
  overrideLookahead: number | null,
  payload: any,
): Promise<Response> {
  const maxUsers: number = Math.min(Math.max(1, Number(payload?.maxUsers) || 50), 500);
  const maxEmailsPerRun: number = Math.min(Math.max(1, Number(payload?.maxEmailsPerRun) || maxUsers), 500);

  let prefsQuery = supabase
    .from('crm_notification_preferences')
    .select('user_id, radar_email_enabled, radar_email_unsubscribed_at, preferred_alert_timing_days, max_emails_per_week')
    .eq('radar_email_enabled', true)
    .is('radar_email_unsubscribed_at', null)
    .limit(maxUsers);
  if (filterUserId) prefsQuery = prefsQuery.eq('user_id', filterUserId);

  const { data: prefsRows, error: prefsErr } = await prefsQuery;
  if (prefsErr) return jsonResp({ success: false, error: prefsErr.message }, 500);

  const usersScanned = filterUserId ? 1 : (prefsRows ?? []).length;
  let skippedUsersPreferences = 0;
  let skippedUsersQuota = 0;
  let skippedNotificationsAlreadyEmailed = 0;
  let notificationsIncluded = 0;
  let usersEligible = 0;
  const previews: Array<Record<string, unknown>> = [];
  const errors: Array<{ userId: string; message: string }> = [];

  if (filterUserId && (prefsRows ?? []).length === 0) skippedUsersPreferences += 1;

  for (const pref of prefsRows ?? []) {
    if (previews.length >= maxEmailsPerRun) break;
    const userId = pref.user_id as string;
    try {
      const built = await buildPreviewForUser(supabase, pref, overrideLookahead);
      skippedNotificationsAlreadyEmailed += built.alreadyEmailedCount;
      if (!built.preview) {
        if (built.skip === 'quota') skippedUsersQuota += 1;
        continue;
      }
      usersEligible += 1;
      notificationsIncluded += built.preview.notificationIds.length;
      previews.push(previewToJson(built.preview));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('preview user failed', { userId, message });
      errors.push({ userId, message });
    }
  }

  return jsonResp({
    success: true, dryRun: true,
    usersScanned, usersEligible,
    emailsWouldSend: previews.length,
    notificationsIncluded,
    skippedUsersPreferences, skippedUsersQuota,
    skippedNotificationsAlreadyEmailed,
    previews, errors,
  });
}