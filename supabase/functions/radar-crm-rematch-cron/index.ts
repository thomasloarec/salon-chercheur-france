// Radar CRM continuous re-matching cron.
//
// Backend-only entrypoint. Re-runs `crm_run_matching` for every completed
// import, then turns the new matches (future events only) into in-app
// notifications grouped per (user, import, event).
//
// Auth gate: caller MUST present `Authorization: Bearer <token>` where token is
// either the service role key (backend/cron) OR a valid user JWT belonging to
// an admin (manual trigger from /admin/radar-crm). Never trust userId from the
// payload for authorization — only as an execution filter.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

type AuthMode = 'service_role' | 'admin'

async function authorizeRequest(
  req: Request,
): Promise<{ ok: true; mode: AuthMode } | { ok: false; status: number; error: string }> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!serviceRoleKey || !supabaseUrl) {
    return { ok: false, status: 500, error: 'Server misconfigured' }
  }
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }

  // Mode A — service role (backend / cron)
  if (timingSafeEqual(token, serviceRoleKey)) {
    return { ok: true, mode: 'service_role' }
  }

  // Mode B — admin user JWT
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!anonKey) return { ok: false, status: 401, error: 'Unauthorized' }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser(token)
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  // Use service-role client to evaluate admin status reliably
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: isAdmin, error: adminErr } = await adminClient.rpc('has_role', {
    _user_id: userData.user.id,
    _role: 'admin',
  } as never)
  if (adminErr || isAdmin !== true) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  return { ok: true, mode: 'admin' }
}

interface NewMatchRow {
  match_id: string
  crm_company_id: string
  company_name: string
  import_id: string
  id_exposant: string
  event_id: string
  normalized_domain: string
  is_future_event: boolean | null
  nom_event: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405)
  const auth = await authorizeRequest(req)
  if (!auth.ok) {
    console.warn('radar-crm-rematch-cron: rejected', { status: auth.status })
    return jsonResp({ error: auth.error }, auth.status)
  }

  let payload: any = {}
  try { payload = await req.json() } catch { /* empty body allowed */ }

  const dryRun: boolean = payload?.dryRun === true
  const maxImports: number = Math.min(
    Math.max(1, Number.isFinite(payload?.maxImports) ? payload.maxImports : 500),
    2000,
  )
  const filterUserId: string | null = typeof payload?.userId === 'string' ? payload.userId : null
  const filterImportId: string | null = typeof payload?.importId === 'string' ? payload.importId : null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // System tracking: started (skipped in dryRun to keep it strictly read-only)
  if (!dryRun) {
    await supabase.from('crm_usage_events').insert({
      event_type: 'radar_rematch_cron_started',
      user_id: null,
      metadata: { source: 'radar_crm_system', dryRun, maxImports, filterUserId, filterImportId } as never,
    })
  }

  // 1. Fetch imports to process
  let importsQuery = supabase
    .from('crm_imports')
    .select('id, user_id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(maxImports)
  if (filterUserId) importsQuery = importsQuery.eq('user_id', filterUserId)
  if (filterImportId) importsQuery = importsQuery.eq('id', filterImportId)

  const { data: imports, error: importsErr } = await importsQuery
  if (importsErr) {
    console.error('Failed to load imports:', importsErr)
    return jsonResp({ success: false, error: importsErr.message }, 500)
  }

  // ---------------------------------------------------------------
  // DRY RUN — strictly read-only estimation. No call to crm_run_matching.
  // No writes to crm_company_event_matches, notifications, or usage events.
  // ---------------------------------------------------------------
  if (dryRun) {
    let estimatedNewMatches = 0
    let estimatedFutureNewMatches = 0
    const estimatedNotificationGroups = new Set<string>()
    const dryErrors: Array<{ importId: string; userId: string; message: string }> = []
    let importsProcessedDry = 0

    for (const imp of imports ?? []) {
      importsProcessedDry++
      try {
        // 1. companies of this import with a normalized domain
        const { data: companies, error: cErr } = await supabase
          .from('crm_companies')
          .select('id, normalized_domain')
          .eq('import_id', imp.id)
          .not('normalized_domain', 'is', null)
        if (cErr) throw new Error(`crm_companies: ${cErr.message}`)
        const domains = Array.from(
          new Set((companies ?? []).map((c: any) => c.normalized_domain).filter(Boolean)),
        )
        if (domains.length === 0) continue
        const companiesByDomain = new Map<string, string[]>()
        for (const c of companies ?? []) {
          const d = (c as any).normalized_domain as string
          const arr = companiesByDomain.get(d) ?? []
          arr.push((c as any).id)
          companiesByDomain.set(d, arr)
        }

        // 2. existing matches for this import → exclusion set
        const { data: existing, error: eErr } = await supabase
          .from('crm_company_event_matches')
          .select('crm_company_id, event_id, id_exposant')
          .eq('user_id', imp.user_id)
        if (eErr) throw new Error(`existing matches: ${eErr.message}`)
        const existingSet = new Set<string>(
          (existing ?? []).map((m: any) => `${m.crm_company_id}|${m.event_id}|${m.id_exposant}`),
        )

        // 3. candidate participations from the view
        const { data: parts, error: pErr } = await supabase
          .from('crm_radar_participations_view')
          .select('event_id, id_exposant, normalized_domain, is_future_event')
          .in('normalized_domain', domains)
        if (pErr) throw new Error(`participations view: ${pErr.message}`)

        for (const p of parts ?? []) {
          const domain = (p as any).normalized_domain as string
          const eventId = (p as any).event_id as string
          const idExposant = (p as any).id_exposant as string
          const isFuture = (p as any).is_future_event === true
          const companyIds = companiesByDomain.get(domain) ?? []
          for (const companyId of companyIds) {
            const key = `${companyId}|${eventId}|${idExposant}`
            if (existingSet.has(key)) continue
            estimatedNewMatches++
            if (isFuture) {
              estimatedFutureNewMatches++
              estimatedNotificationGroups.add(`${imp.user_id}|${imp.id}|${eventId}`)
            }
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error('Dry-run estimation failed', { importId: imp.id, userId: imp.user_id, message })
        dryErrors.push({ importId: imp.id, userId: imp.user_id, message })
      }
    }

    const dryResp = {
      success: true,
      dryRun: true,
      importsProcessed: importsProcessedDry,
      estimatedNewMatches,
      estimatedFutureNewMatches,
      estimatedNotifications: estimatedNotificationGroups.size,
      notificationsCreated: 0,
      notificationsUpdated: 0,
      errors: dryErrors,
    }
    console.log('radar-crm-rematch-cron dry-run summary', dryResp)
    return jsonResp(dryResp)
  }

  const errors: Array<{ importId: string; userId: string; message: string }> = []
  let importsProcessed = 0
  let newMatchesCreated = 0
  let futureNewMatches = 0
  let notificationsCreated = 0
  let notificationsUpdated = 0
  let skippedNotificationsPreferences = 0
  let missingNotificationsCreated = 0
  let missingNotificationsSkippedExisting = 0
  let missingNotificationsSkippedPreferences = 0

  for (const imp of imports ?? []) {
    importsProcessed++
    try {
      // Ensure radar access (beta) for this user
      await supabase.rpc('ensure_user_radar_access', { _user_id: imp.user_id })

      // Load preferences (default: alerts enabled)
      const { data: prefs } = await supabase
        .from('crm_notification_preferences')
        .select('radar_alerts_enabled')
        .eq('user_id', imp.user_id)
        .maybeSingle()
      const alertsEnabled = prefs?.radar_alerts_enabled !== false

      // Run matching (idempotent thanks to ON CONFLICT)
      const { data: matchData, error: matchErr } = await supabase.rpc('crm_run_matching', {
        p_import_id: imp.id,
        p_user_id: imp.user_id,
      })
      if (matchErr) throw new Error(`crm_run_matching: ${matchErr.message}`)

      const newMatches: NewMatchRow[] = ((matchData as any)?.newMatches ?? []) as NewMatchRow[]
      newMatchesCreated += newMatches.length
      const futureMatches = newMatches.filter((m) => m.is_future_event === true)
      futureNewMatches += futureMatches.length

      if (futureMatches.length === 0) continue
      if (!alertsEnabled) {
        skippedNotificationsPreferences += 1
        continue
      }
      if (dryRun) continue

      // Group by event_id
      const byEvent = new Map<string, NewMatchRow[]>()
      for (const m of futureMatches) {
        const arr = byEvent.get(m.event_id) ?? []
        arr.push(m)
        byEvent.set(m.event_id, arr)
      }

      // Enrich events
      const eventIds = Array.from(byEvent.keys())
      const { data: eventRows } = await supabase
        .from('events')
        .select('id, nom_event, slug, date_debut, ville, nom_lieu, url_image')
        .in('id', eventIds)
      const eventMap = new Map<string, any>((eventRows ?? []).map((e: any) => [e.id, e]))

      // Enrich stand info from view
      const exposantIds = Array.from(new Set(futureMatches.map((m) => m.id_exposant)))
      const { data: viewRows } = await supabase
        .from('crm_radar_participations_view')
        .select('event_id, id_exposant, stand_exposants_list')
        .in('event_id', eventIds)
        .in('id_exposant', exposantIds)
      const standMap = new Map<string, string | null>(
        (viewRows ?? []).map((v: any) => [`${v.event_id}|${v.id_exposant}`, v.stand_exposants_list ?? null]),
      )

      for (const [eventId, matches] of byEvent.entries()) {
        const ev = eventMap.get(eventId) ?? {}
        const eventName: string = ev.nom_event ?? matches[0].nom_event ?? 'un salon'
        const groupKey = `radar_crm:${imp.user_id}:${imp.id}:${eventId}`

        const companies = matches.map((m) => ({
          crmCompanyId: m.crm_company_id,
          companyName: m.company_name,
          idExposant: m.id_exposant,
          stand: standMap.get(`${eventId}|${m.id_exposant}`) ?? null,
        }))

        // Look for an existing UNREAD notification with same group_key
        const { data: existing } = await supabase
          .from('notifications')
          .select('id, group_count, metadata')
          .eq('user_id', imp.user_id)
          .eq('group_key', groupKey)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing) {
          // Merge companies (dedupe by crmCompanyId)
          const prevCompanies: any[] = Array.isArray((existing.metadata as any)?.companies)
            ? (existing.metadata as any).companies
            : []
          const seen = new Set<string>(prevCompanies.map((c) => c.crmCompanyId))
          const merged = [...prevCompanies]
          for (const c of companies) if (!seen.has(c.crmCompanyId)) { merged.push(c); seen.add(c.crmCompanyId) }

          const newCount = merged.length
          const message = newCount === 1
            ? `${merged[0].companyName} expose à ${eventName}`
            : `${newCount} entreprises de votre Radar CRM exposent à ${eventName}`

          const { error: updErr } = await supabase
            .from('notifications')
            .update({
              group_count: newCount,
              message,
              metadata: { ...(existing.metadata as any), companies: merged },
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
          if (updErr) throw new Error(`notification update: ${updErr.message}`)
          notificationsUpdated++
        } else {
          const count = companies.length
          const message = count === 1
            ? `${companies[0].companyName} expose à ${eventName}`
            : `${count} entreprises de votre Radar CRM exposent à ${eventName}`

          const metadata = {
            source: 'radar_crm',
            importId: imp.id,
            eventId,
            eventName,
            eventDate: ev.date_debut ?? null,
            eventCity: ev.ville ?? null,
            eventVenue: ev.nom_lieu ?? null,
            eventSlug: ev.slug ?? null,
            eventImage: ev.url_image ?? null,
            companies,
          }

          const { error: insErr } = await supabase.from('notifications').insert({
            user_id: imp.user_id,
            type: 'radar_new_matches',
            category: 'radar_crm',
            title: 'Nouvelle opportunité Radar CRM',
            message,
            icon: '🎯',
            event_id: eventId,
            link_url: `/radar-crm/results?importId=${imp.id}&eventId=${eventId}`,
            group_key: groupKey,
            group_count: count,
            metadata: metadata as never,
          })
          if (insErr) throw new Error(`notification insert: ${insErr.message}`)
          notificationsCreated++

          await supabase.from('crm_usage_events').insert({
            event_type: 'radar_notification_created',
            user_id: null,
            metadata: { source: 'radar_crm_system', userId: imp.user_id, importId: imp.id, eventId, count } as never,
          })
        }
      }

      if (futureMatches.length > 0) {
        await supabase.from('crm_usage_events').insert({
          event_type: 'radar_rematch_new_matches_detected',
          user_id: null,
          metadata: {
            source: 'radar_crm_system',
            userId: imp.user_id,
            importId: imp.id,
            futureNewMatches: futureMatches.length,
          } as never,
        })
      }

      // -----------------------------------------------------------
      // RECONCILIATION — for matches that already existed but never
      // produced a notification (e.g. previous insert blocked by the
      // notifications_category_check constraint).
      // -----------------------------------------------------------
      if (alertsEnabled) {
        // 1. All existing matches for this import (via crm_companies)
        const { data: importCompanies } = await supabase
          .from('crm_companies')
          .select('id, company_name')
          .eq('import_id', imp.id)
          .eq('user_id', imp.user_id)
        const companyMap = new Map<string, string>(
          (importCompanies ?? []).map((c: any) => [c.id, c.company_name]),
        )
        const companyIds = Array.from(companyMap.keys())
        if (companyIds.length > 0) {
          const { data: allMatches } = await supabase
            .from('crm_company_event_matches')
            .select('crm_company_id, event_id, id_exposant')
            .eq('user_id', imp.user_id)
            .in('crm_company_id', companyIds)

          // Filter to future events
          const matchEventIds = Array.from(new Set((allMatches ?? []).map((m: any) => m.event_id)))
          if (matchEventIds.length > 0) {
            const { data: evs } = await supabase
              .from('events')
              .select('id, nom_event, slug, date_debut, ville, nom_lieu, url_image')
              .in('id', matchEventIds)
            const evMap = new Map<string, any>((evs ?? []).map((e: any) => [e.id, e]))
            const today = new Date(); today.setHours(0, 0, 0, 0)

            // Group future matches by event
            const groupedByEvent = new Map<string, Array<{ crmCompanyId: string; companyName: string; idExposant: string }>>()
            for (const m of allMatches ?? []) {
              const ev = evMap.get((m as any).event_id)
              if (!ev || !ev.date_debut) continue
              if (new Date(ev.date_debut) < today) continue
              const arr = groupedByEvent.get((m as any).event_id) ?? []
              arr.push({
                crmCompanyId: (m as any).crm_company_id,
                companyName: companyMap.get((m as any).crm_company_id) ?? 'Entreprise',
                idExposant: (m as any).id_exposant,
              })
              groupedByEvent.set((m as any).event_id, arr)
            }

            // Stand info
            const exposantIdsR = Array.from(new Set(
              Array.from(groupedByEvent.values()).flat().map((c) => c.idExposant),
            ))
            const eventIdsR = Array.from(groupedByEvent.keys())
            const standMapR = new Map<string, string | null>()
            if (exposantIdsR.length > 0 && eventIdsR.length > 0) {
              const { data: viewRowsR } = await supabase
                .from('crm_radar_participations_view')
                .select('event_id, id_exposant, stand_exposants_list')
                .in('event_id', eventIdsR)
                .in('id_exposant', exposantIdsR)
              for (const v of viewRowsR ?? []) {
                standMapR.set(`${(v as any).event_id}|${(v as any).id_exposant}`, (v as any).stand_exposants_list ?? null)
              }
            }

            for (const [eventId, companies] of groupedByEvent.entries()) {
              const groupKey = `radar_crm:${imp.user_id}:${imp.id}:${eventId}`
              const { data: existingNotif } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', imp.user_id)
                .eq('type', 'radar_new_matches')
                .eq('group_key', groupKey)
                .limit(1)
                .maybeSingle()
              if (existingNotif) {
                missingNotificationsSkippedExisting++
                continue
              }
              const ev = evMap.get(eventId) ?? {}
              const eventName: string = ev.nom_event ?? 'un salon'
              const enrichedCompanies = companies.map((c) => ({
                ...c,
                stand: standMapR.get(`${eventId}|${c.idExposant}`) ?? null,
              }))
              const count = enrichedCompanies.length
              const message = count === 1
                ? `${enrichedCompanies[0].companyName} expose à ${eventName}`
                : `${count} entreprises de votre Radar CRM exposent à ${eventName}`
              const metadata = {
                source: 'radar_crm',
                importId: imp.id,
                eventId,
                eventName,
                eventDate: ev.date_debut ?? null,
                eventCity: ev.ville ?? null,
                eventVenue: ev.nom_lieu ?? null,
                eventSlug: ev.slug ?? null,
                eventImage: ev.url_image ?? null,
                companies: enrichedCompanies,
                reconciliation: true,
              }
              const { error: recInsErr } = await supabase.from('notifications').insert({
                user_id: imp.user_id,
                type: 'radar_new_matches',
                category: 'radar_crm',
                title: 'Nouvelle opportunité Radar CRM',
                message,
                icon: '🎯',
                event_id: eventId,
                link_url: `/radar-crm/results?importId=${imp.id}&eventId=${eventId}`,
                group_key: groupKey,
                group_count: count,
                metadata: metadata as never,
              })
              if (recInsErr) {
                throw new Error(`reconciliation notification insert: ${recInsErr.message}`)
              }
              missingNotificationsCreated++
              await supabase.from('crm_usage_events').insert({
                event_type: 'radar_notification_reconciled',
                user_id: null,
                metadata: { source: 'radar_crm_system', userId: imp.user_id, importId: imp.id, eventId, count } as never,
              })
            }
          }
        }
      } else {
        missingNotificationsSkippedPreferences++
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Import processing failed', { importId: imp.id, userId: imp.user_id, message })
      errors.push({ importId: imp.id, userId: imp.user_id, message })
    }
  }

  const summary = {
    success: true,
    dryRun,
    importsProcessed,
    newMatchesCreated,
    futureNewMatches,
    notificationsCreated,
    notificationsUpdated,
    skippedNotificationsPreferences,
    missingNotificationsCreated,
    missingNotificationsSkippedExisting,
    missingNotificationsSkippedPreferences,
    errors,
  }

  await supabase.from('crm_usage_events').insert({
    event_type: 'radar_rematch_cron_completed',
    user_id: null,
    metadata: { source: 'radar_crm_system', ...summary } as never,
  })

  console.log('radar-crm-rematch-cron summary', summary)
  return jsonResp(summary)
})