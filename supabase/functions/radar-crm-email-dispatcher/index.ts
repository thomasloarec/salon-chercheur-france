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
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';
import { renderEmail, renderTeaserEmail } from './email-render.ts';

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

// Dedup key per EXHIBITOR (DISTINCT ON (user_id, event_id, id_exposant)).
// Successive CRM imports can create several crm_companies rows for the same
// domain → several crm_company_event_matches → several metadata.companies
// entries that all point to the SAME Lotexpo exposant. Keying on id_exposant
// collapses them to a single entry per exhibitor per salon, matching the
// Radar CRM page behaviour. Falls back to companyKey when id_exposant is absent.
function exhibitorDedupKey(co: any): string | null {
  if (co?.idExposant) return `ex:${String(co.idExposant)}`;
  return companyKey(co);
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
  starredCount: number;
  notificationIds: string[];
  eventIds: string[];
  importIds: string[];
  groups: GroupedEvent[];
};

type SkipReason = 'preferences' | 'quota' | 'no_notifications' | 'no_eligible' | 'all_already_emailed';

type BuildSkipCounters = {
  skippedCompaniesMissingMatch: number;
  skippedCompaniesNeedsReview: number;
  skippedNotificationsEmptyAfterFiltering: number;
  skippedNotificationsDeletedImport: number;
};

function emptySkipCounters(): BuildSkipCounters {
  return {
    skippedCompaniesMissingMatch: 0,
    skippedCompaniesNeedsReview: 0,
    skippedNotificationsEmptyAfterFiltering: 0,
    skippedNotificationsDeletedImport: 0,
  };
}

function addSkipCounters(a: BuildSkipCounters, b: BuildSkipCounters): BuildSkipCounters {
  return {
    skippedCompaniesMissingMatch: a.skippedCompaniesMissingMatch + b.skippedCompaniesMissingMatch,
    skippedCompaniesNeedsReview: a.skippedCompaniesNeedsReview + b.skippedCompaniesNeedsReview,
    skippedNotificationsEmptyAfterFiltering: a.skippedNotificationsEmptyAfterFiltering + b.skippedNotificationsEmptyAfterFiltering,
    skippedNotificationsDeletedImport: a.skippedNotificationsDeletedImport + b.skippedNotificationsDeletedImport,
  };
}

async function buildPreviewForUser(
  supabase: ReturnType<typeof createClient>,
  pref: any,
  overrideLookahead: number | null,
): Promise<{ preview: PreviewBuild | null; skip?: SkipReason; alreadyEmailedCount: number; skipCounters: BuildSkipCounters }> {
  const userId = pref.user_id as string;
  const timingDays = overrideLookahead ?? Number(pref.preferred_alert_timing_days) ?? 14;
  const maxPerWeek = Number(pref.max_emails_per_week) ?? 2;
  const skipCounters = emptySkipCounters();

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
    return { preview: null, skip: 'quota', alreadyEmailedCount: 0, skipCounters };
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
    return { preview: null, skip: 'no_notifications', alreadyEmailedCount: 0, skipCounters };
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
      .from('events').select('id, nom_event, slug, date_debut, ville, nom_lieu, url_image, visible').in('id', eventIds);
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
    // event.visible must be true when the column is present (defensive: missing column => allow).
    if (ev.visible === false) continue;
    const evDate = new Date(`${ev.date_debut}T00:00:00Z`);
    if (evDate < minDate || evDate > maxDate) continue;
    const meta = (n.metadata ?? {}) as Record<string, unknown>;
    const companies = Array.isArray(meta.companies) ? (meta.companies as any[]) : [];
    candidates.push({ notification: n, event: ev, companies });
  }

  if (candidates.length === 0) {
    const skip: SkipReason = alreadyEmailedCount > 0 ? 'all_already_emailed' : 'no_eligible';
    return { preview: null, skip, alreadyEmailedCount, skipCounters };
  }

  // ------------------------------------------------------------------
  // STRICT ELIGIBILITY FILTER (Incident Airbus/Age 3 — V3 hardening).
  //
  // A company in a notification's metadata is eligible only if EVERY
  // one of these conditions holds against the current database state:
  //   1. crm_company_event_matches row exists (user_id, event_id,
  //      crm_company_id, id_exposant from metadata.companies[]);
  //   2. needs_review = false on that match;
  //   3. crm_companies row still exists for crm_company_id;
  //   4. crm_imports row still exists for crm_companies.import_id and
  //      status = 'completed' (covers the corrupted/deleted import
  //      42825220-c9bb-4749-9bfd-ba86ed15084c case).
  //
  // We never trust metadata.companyName / metadata.importId alone:
  // the primary display name is rebuilt from exposants.nom_exposant.
  // ------------------------------------------------------------------

  const allCrmCompanyIdsRaw: string[] = [];
  const matchProbeKeys: Array<{ eventId: string; crmCompanyId: string; idExposant: string }> = [];
  for (const c of candidates) {
    for (const co of c.companies) {
      const cid = typeof co?.crmCompanyId === 'string' ? co.crmCompanyId : null;
      const idEx = typeof co?.idExposant === 'string' ? co.idExposant : null;
      if (!cid || !idEx) continue;
      allCrmCompanyIdsRaw.push(cid);
      matchProbeKeys.push({ eventId: c.event.id as string, crmCompanyId: cid, idExposant: idEx });
    }
  }
  const allCrmCompanyIds = Array.from(new Set(allCrmCompanyIdsRaw));
  const allEventIds = Array.from(new Set(candidates.map((c) => c.event.id as string)));

  // Bulk-load matches for this user in scope.
  type MatchRow = {
    event_id: string;
    crm_company_id: string;
    id_exposant: string;
    needs_review: boolean;
  };
  const matchKey = (eventId: string, crmCompanyId: string, idExposant: string) =>
    `${eventId}|${crmCompanyId}|${idExposant}`;
  const validMatchKeys = new Set<string>();
  const needsReviewKeys = new Set<string>();
  if (allEventIds.length > 0 && allCrmCompanyIds.length > 0) {
    const { data: matchRows } = await supabase
      .from('crm_company_event_matches')
      .select('event_id, crm_company_id, id_exposant, needs_review')
      .eq('user_id', userId)
      .in('event_id', allEventIds)
      .in('crm_company_id', allCrmCompanyIds);
    for (const m of (matchRows ?? []) as MatchRow[]) {
      const k = matchKey(m.event_id, m.crm_company_id, m.id_exposant);
      if (m.needs_review === true) needsReviewKeys.add(k);
      else validMatchKeys.add(k);
    }
  }

  // Bulk-load CRM companies + import status.
  const crmCompanyMap = new Map<string, { id: string; company_name: string | null; import_id: string | null; normalized_domain: string | null; website_raw: string | null }>();
  const completedImportIds = new Set<string>();
  if (allCrmCompanyIds.length > 0) {
    const { data: crmRows } = await supabase
      .from('crm_companies')
      .select('id, company_name, import_id, normalized_domain, website_raw')
      .in('id', allCrmCompanyIds);
    for (const r of crmRows ?? []) {
      crmCompanyMap.set((r as any).id, r as any);
    }
    const importIds = Array.from(new Set(
      Array.from(crmCompanyMap.values()).map((c) => c.import_id).filter((v): v is string => Boolean(v)),
    ));
    if (importIds.length > 0) {
      const { data: importRows } = await supabase
        .from('crm_imports')
        .select('id, status')
        .in('id', importIds)
        .eq('status', 'completed');
      for (const r of importRows ?? []) completedImportIds.add((r as any).id);
    }
  }

  // Bulk-load exposants for primary display name (nom_exposant).
  const allIdExposants = Array.from(new Set(matchProbeKeys.map((k) => k.idExposant)));
  const exposantNameMap = new Map<string, string>();
  if (allIdExposants.length > 0) {
    const { data: expoRows } = await supabase
      .from('exposants')
      .select('id_exposant, nom_exposant')
      .in('id_exposant', allIdExposants);
    for (const r of expoRows ?? []) {
      const k = (r as any).id_exposant as string | null;
      const n = (r as any).nom_exposant as string | null;
      if (k && n) exposantNameMap.set(k, n);
    }
  }

  // Apply strict filter to each candidate notification.
  const filteredCandidates: Array<{ notification: NotificationRow; event: any; companies: any[] }> = [];
  for (const c of candidates) {
    const meta = (c.notification.metadata ?? {}) as Record<string, unknown>;
    const metaImportId =
      (typeof meta.importId === 'string' && meta.importId) ||
      (typeof meta.import_id === 'string' && meta.import_id) ||
      null;

    const keepCompanies: any[] = [];
    let companiesEvaluated = 0;
    for (const co of c.companies) {
      companiesEvaluated += 1;
      const cid: string | null = typeof co?.crmCompanyId === 'string' ? co.crmCompanyId : null;
      const idEx: string | null = typeof co?.idExposant === 'string' ? co.idExposant : null;
      if (!cid || !idEx) {
        skipCounters.skippedCompaniesMissingMatch += 1;
        continue;
      }
      const k = matchKey(c.event.id as string, cid, idEx);
      if (needsReviewKeys.has(k)) {
        skipCounters.skippedCompaniesNeedsReview += 1;
        continue;
      }
      if (!validMatchKeys.has(k)) {
        skipCounters.skippedCompaniesMissingMatch += 1;
        continue;
      }
      const crmCompany = crmCompanyMap.get(cid);
      if (!crmCompany) {
        skipCounters.skippedCompaniesMissingMatch += 1;
        continue;
      }
      if (!crmCompany.import_id || !completedImportIds.has(crmCompany.import_id)) {
        // Import deleted or not completed (e.g. import 42825220-...).
        skipCounters.skippedCompaniesMissingMatch += 1;
        continue;
      }
      const exhibitorName = exposantNameMap.get(idEx) ?? null;
      keepCompanies.push({
        ...co,
        crmCompanyId: cid,
        idExposant: idEx,
        exhibitorName, // primary display name (real Lotexpo exposant)
        companyName: crmCompany.company_name ?? co.companyName ?? null,
        normalizedDomain: crmCompany.normalized_domain ?? co.normalizedDomain ?? null,
        website: crmCompany.website_raw ?? co.website ?? null,
      });
    }

    if (keepCompanies.length === 0) {
      // Distinguish "import deleted" from "empty after filtering" for the report.
      const importExisted = metaImportId
        ? Array.from(crmCompanyMap.values()).some(
            (cc) => cc.import_id === metaImportId && completedImportIds.has(metaImportId),
          )
        : false;
      if (metaImportId && !importExisted) {
        skipCounters.skippedNotificationsDeletedImport += 1;
      } else if (companiesEvaluated > 0) {
        skipCounters.skippedNotificationsEmptyAfterFiltering += 1;
      }
      continue;
    }
    filteredCandidates.push({ ...c, companies: keepCompanies });
  }

  if (filteredCandidates.length === 0) {
    const skip: SkipReason = alreadyEmailedCount > 0 ? 'all_already_emailed' : 'no_eligible';
    return { preview: null, skip, alreadyEmailedCount, skipCounters };
  }

  // ---- TRIAGE (account-level star/ignore prefs) ----
  const triageAccountId = await resolveActiveAccountId(supabase, userId);
  const companyPrefs = await loadCompanyPrefs(supabase, triageAccountId);
  const triagedCandidates: typeof filteredCandidates = [];
  for (const c of filteredCandidates) {
    const keep: any[] = [];
    for (const co of c.companies) {
      const key = companyPrefKey(co);
      const status = key ? companyPrefs.get(key) : undefined;
      if (status === 'ignored') continue;                  // user said "ignore" → exclude
      keep.push({ ...co, isStarred: status === 'starred' });
    }
    if (keep.length > 0) triagedCandidates.push({ ...c, companies: keep });
  }
  if (triagedCandidates.length === 0) {
    return { preview: null, skip: 'no_eligible', alreadyEmailedCount, skipCounters };
  }

  const groupedMap = new Map<string, GroupedEvent>();
  for (const c of triagedCandidates) {
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
      const key = exhibitorDedupKey(co); if (!key) continue;
      if (g.companies.some((x) => exhibitorDedupKey(x) === key)) continue;
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

  // Starred companies first within each event card.
  for (const g of top) {
    g.companies.sort((a: any, b: any) => (b.isStarred ? 1 : 0) - (a.isStarred ? 1 : 0));
  }

  // Note: companies were already enriched (exhibitorName, companyName,
  // normalizedDomain) during the strict filter pass above. No second
  // enrichment query is needed here.

  let emailTo: string | null = null;
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    emailTo = userData?.user?.email ?? null;
  } catch (_) { /* ignore */ }

  const companyKeys = new Set<string>();
  for (const g of top) for (const co of g.companies) {
    const k = exhibitorDedupKey(co); if (k) companyKeys.add(k);
  }
  const companiesCount = companyKeys.size;
  const eventsCount = top.length;

  const starredKeys = new Set<string>();
  for (const g of top) for (const co of g.companies as any[]) {
    if (co.isStarred) { const k = exhibitorDedupKey(co); if (k) starredKeys.add(k); }
  }
  const starredCount = starredKeys.size;

  // Smart subject line — fall back to generic if names would be too long.
  const SUBJECT_MAX = 90;
  // Subject uses the real exposant name (exposants.nom_exposant) when known,
  // not the CRM-supplied companyName which may be stale or misleading.
  const firstCompanyName: string | null = (() => {
    for (const g of top) for (const co of g.companies as any[]) {
      if (co?.exhibitorName) return String(co.exhibitorName);
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

  const firstStarredName: string | null = (() => {
    for (const g of top) for (const co of g.companies as any[]) {
      if (co?.isStarred && (co.exhibitorName || co.companyName)) {
        return String(co.exhibitorName ?? co.companyName);
      }
    }
    return null;
  })();
  if (firstStarredName) {
    const starSubj = firstEventName
      ? `★ ${firstStarredName} expose bientôt à ${firstEventName}`
      : `★ ${firstStarredName} expose bientôt`;
    subject = starSubj.length <= SUBJECT_MAX ? starSubj : `★ ${firstStarredName} expose bientôt`;
  }

  const notificationIds = top.flatMap((g) => g.notificationIds);
  const importIds = Array.from(new Set(top.flatMap((g) => g.importIds)));
  const eventIdsOut = top.map((g) => g.eventId);

  return {
    preview: {
      userId, emailTo, subject,
      eventsCount, companiesCount, starredCount,
      notificationIds, eventIds: eventIdsOut, importIds,
      groups: top,
    },
    alreadyEmailedCount,
    skipCounters,
  };
}

function previewToJson(p: PreviewBuild) {
  return {
    userId: p.userId,
    emailTo: p.emailTo,
    subject: p.subject,
    eventsCount: p.eventsCount,
    companiesCount: p.companiesCount,
    starredCount: p.starredCount,
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
        idExposant: co.idExposant ?? null,
        exhibitorName: co.exhibitorName ?? null,
        companyName: co.companyName ?? null,
        stand: co.stand ?? null,
        normalizedDomain: co.normalizedDomain ?? null,
        isStarred: co.isStarred ?? false,
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

// Resolve Radar entitlement for a user via the canonical SQL function.
// Fail-safe: on any error, treat as LOCKED (teaser) — never leak full details.
async function userHasRadarAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_radar_access', { p_user_id: userId } as never);
    if (error) {
      console.warn('has_radar_access failed', { userId, error: error.message });
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn('has_radar_access threw', { userId, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

// Resolve the user's canonical Radar account WITHOUT side effects.
// (Same resolution as set_radar_company_pref: oldest active membership on a
// non-deleted account — but SELECT-only. We must NOT call
// resolve_radar_account_for_user here, which creates an account on miss.)
async function resolveActiveAccountId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: members } = await supabase
    .from('radar_members')
    .select('radar_account_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  const accountIds = (members ?? [])
    .map((m: any) => m.radar_account_id)
    .filter((v: any): v is string => Boolean(v));
  if (accountIds.length === 0) return null;
  const { data: accts } = await supabase
    .from('radar_accounts')
    .select('id, created_at')
    .in('id', accountIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  return (accts?.[0] as any)?.id ?? null;
}

// Load account-level company prefs (starred/ignored) keyed by company_key.
// Fail-OPEN: on any miss/error, return an empty map (show everything, no
// stars) — never silently hide a user's matches because prefs failed to load.
async function loadCompanyPrefs(
  supabase: ReturnType<typeof createClient>,
  accountId: string | null,
): Promise<Map<string, 'starred' | 'ignored'>> {
  const map = new Map<string, 'starred' | 'ignored'>();
  if (!accountId) return map;
  const { data: rows } = await supabase
    .from('radar_company_prefs')
    .select('company_key, status')
    .eq('radar_account_id', accountId);
  for (const r of rows ?? []) {
    const k = (r as any).company_key as string | null;
    const s = (r as any).status as string | null;
    if (k && (s === 'starred' || s === 'ignored')) map.set(k, s);
  }
  return map;
}

// Same key as the SQL radar_company_key(domain, name):
// coalesce(nullif(lower(trim(domain)),''), lower(trim(name))).
function companyPrefKey(co: any): string | null {
  const domain = co?.normalizedDomain ? String(co.normalizedDomain).trim().toLowerCase() : '';
  const name = co?.companyName ? String(co.companyName).trim().toLowerCase() : '';
  return domain || name || null;
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
    ...(r.skipCounters ?? emptySkipCounters()),
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
  let aggregateSkipCounters = emptySkipCounters();
  const errors: Array<{ userId: string; message: string }> = [];
  const sent: Array<{ userId: string; emailTo: string | null; logId: string; resendMessageId: string }> = [];

  for (const pref of prefsRows ?? []) {
    if (emailsSent >= maxEmailsPerRun) break;
    const userId = pref.user_id as string;
    try {
      const r = await sendRealForUser(supabase, pref, overrideLookahead);
      skippedNotificationsAlreadyEmailed += r.skippedNotificationsAlreadyEmailed ?? 0;
      if (r.skipCounters) aggregateSkipCounters = addSkipCounters(aggregateSkipCounters, r.skipCounters);
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
    ...aggregateSkipCounters,
    errorsCount: errors.length,
  });

  return jsonResp({
    success: true, dryRun: false, sendReal: true, mode: 'batch',
    usersScanned, usersEligible, emailsSent, emailsFailed,
    notificationsIncluded,
    skippedUsersPreferences, skippedUsersQuota,
    skippedNotificationsAlreadyEmailed,
    ...aggregateSkipCounters,
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
  skipCounters?: BuildSkipCounters;
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
      skipCounters: built.skipCounters,
      response: {
        success: true, dryRun: false, sendReal: true,
        emailsSent: 0,
        reason: built.skip ?? 'no_eligible',
        skippedNotificationsAlreadyEmailed: built.alreadyEmailedCount,
        ...built.skipCounters,
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

  // Entitlement branch: active access → full digest; locked → teaser.
  const hasAccess = await userHasRadarAccess(supabase, filterUserId);
  const visibilityMode: 'full' | 'teaser' = hasAccess ? 'full' : 'teaser';
  const emailType: 'radar_digest' | 'teaser' = hasAccess ? 'radar_digest' : 'teaser';
  const subjectToSend = hasAccess
    ? p.subject
    : (p.companiesCount > 1
        ? `${p.companiesCount} entreprises de votre CRM exposent bientôt`
        : `1 entreprise de votre CRM expose bientôt`);

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
      email_subject: subjectToSend,
      email_type: emailType,
      visibility_mode: visibilityMode,
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
  const pToRender = hasAccess ? p : { ...p, subject: subjectToSend };
  const { html, text } = hasAccess
    ? renderEmail(pToRender, unsubscribeUrl, appBaseUrl)
    : renderTeaserEmail(pToRender, unsubscribeUrl, appBaseUrl);

  try {
    const { id: resendId } = await sendResendEmail({
      to: p.emailTo,
      subject: subjectToSend,
      html, text,
      tags: [
        { name: 'feature', value: 'radar_crm' },
        { name: 'email_type', value: emailType },
        { name: 'visibility', value: visibilityMode },
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
      skipCounters: built.skipCounters,
      response: {
        success: true, dryRun: false, sendReal: true,
        emailsSent: 1,
        emailTo: p.emailTo, subject: subjectToSend,
        resendMessageId: resendId, status: 'sent', logId,
        notificationIdsIncluded: p.notificationIds,
        skippedNotificationsAlreadyEmailed: built.alreadyEmailedCount,
        ...built.skipCounters,
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
  let aggregateSkipCounters = emptySkipCounters();
  const previews: Array<Record<string, unknown>> = [];
  const errors: Array<{ userId: string; message: string }> = [];

  if (filterUserId && (prefsRows ?? []).length === 0) skippedUsersPreferences += 1;

  for (const pref of prefsRows ?? []) {
    if (previews.length >= maxEmailsPerRun) break;
    const userId = pref.user_id as string;
    try {
      const built = await buildPreviewForUser(supabase, pref, overrideLookahead);
      skippedNotificationsAlreadyEmailed += built.alreadyEmailedCount;
      aggregateSkipCounters = addSkipCounters(aggregateSkipCounters, built.skipCounters);
      if (!built.preview) {
        if (built.skip === 'quota') skippedUsersQuota += 1;
        continue;
      }
      usersEligible += 1;
      notificationsIncluded += built.preview.notificationIds.length;
      const hasAccess = await userHasRadarAccess(supabase, userId);
      const previewJson = previewToJson(built.preview) as Record<string, unknown>;
      previewJson.visibilityMode = hasAccess ? 'full' : 'teaser';
      previews.push(previewJson);
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
    ...aggregateSkipCounters,
    previews, errors,
  });
}