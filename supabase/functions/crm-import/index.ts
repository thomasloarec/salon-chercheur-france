import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_ROWS = 5000

// Mirror of the SQL public.normalize_domain() function so we can dedupe rows
// inside a single uploaded file BEFORE the UPSERT. Without this, two rows that
// resolve to the same normalized_domain would make ON CONFLICT DO UPDATE
// affect the same row twice in one statement (cardinality_violation).
function normalizeDomainLocal(input: string | null | undefined): string | null {
  let s = String(input ?? '').trim().toLowerCase()
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '') // scheme
  s = s.replace(/^www[0-9]?\./i, '')            // www / www2 prefix
  s = s.replace(/[/?#].*$/, '')                 // path / query / fragment
  s = s.replace(/:\d+$/, '')                    // port
  s = s.replace(/\.$/, '')                      // trailing dot
  return s.length > 0 ? s : null
}

interface MappingShape {
  company_name: string
  website_raw?: string | null
  crm_status?: string | null
  owner_name?: string | null
  owner_email?: string | null
  notes?: string | null
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResp({ error: 'Authentication required' }, 401)
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      },
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return jsonResp({ error: 'Authentication required' }, 401)
    }

    let payload: any
    try {
      payload = await req.json()
    } catch {
      return jsonResp({ error: 'Invalid JSON body' }, 400)
    }

    const fileName: string = (payload?.fileName ?? 'import.csv').toString().slice(0, 255)
    const rawSourceType = typeof payload?.sourceType === 'string' ? payload.sourceType.toLowerCase() : 'csv'
    const sourceType: 'csv' | 'excel' = rawSourceType === 'excel' ? 'excel' : 'csv'
    const mapping: MappingShape | undefined = payload?.mapping
    const rows: Array<Record<string, unknown>> | undefined = payload?.rows

    if (!mapping || typeof mapping !== 'object' || !mapping.company_name) {
      return jsonResp({ error: 'Invalid mapping: company_name column is required' }, 400)
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonResp({ error: 'No rows provided' }, 400)
    }
    if (rows.length > MAX_ROWS) {
      return jsonResp({ error: `Too many rows (max ${MAX_ROWS})` }, 400)
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Beta rate-limit: max 3 imports (processing/completed) per user per 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount, error: rlErr } = await serviceClient
      .from('crm_imports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['processing', 'completed'])
      .gte('created_at', since)
    if (rlErr) {
      console.error('Rate-limit check failed:', rlErr)
    } else if ((recentCount ?? 0) >= 3) {
      return jsonResp(
        {
          error: 'rate_limited',
          message: 'Vous avez atteint la limite Beta de 3 imports par jour. Réessayez demain.',
        },
        429,
      )
    }

    // 1. Create import row
    const { data: importRow, error: importErr } = await serviceClient
      .from('crm_imports')
      .insert({
        user_id: user.id,
        source_type: sourceType,
        file_name: fileName,
        status: 'processing',
        total_rows: rows.length,
      })
      .select('id')
      .single()

    if (importErr || !importRow) {
      console.error('Failed to create import:', importErr)
      return jsonResp({ error: 'Failed to create import' }, 500)
    }

    const importId = importRow.id as string

    try {
      // 2. Build company rows
      const companyRows = rows
        .map((r) => {
          const get = (key?: string | null) => {
            if (!key) return null
            const v = r[key]
            if (v === undefined || v === null) return null
            const s = String(v).trim()
            return s.length > 0 ? s : null
          }
          const name = get(mapping.company_name)
          if (!name) return null
          return {
            user_id: user.id,
            import_id: importId,
            company_name: name.slice(0, 500),
            website_raw: get(mapping.website_raw)?.slice(0, 500) ?? null,
            crm_status: get(mapping.crm_status)?.slice(0, 100) ?? null,
            owner_name: get(mapping.owner_name)?.slice(0, 200) ?? null,
            owner_email: get(mapping.owner_email)?.slice(0, 200) ?? null,
            notes: get(mapping.notes)?.slice(0, 2000) ?? null,
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (companyRows.length === 0) {
        await serviceClient
          .from('crm_imports')
          .update({ status: 'failed', error_message: 'No valid company rows' })
          .eq('id', importId)
        return jsonResp({ error: 'No valid company rows after parsing' }, 400)
      }

      // 3. Dedupe rows of THIS file by (user_id, normalized_domain) so a single
      //    UPSERT statement never tries to update the same target row twice.
      //    Rows without a resolvable domain (normalized_domain = null) can never
      //    collide on the unique key, so we always keep them.
      const nowIso = new Date().toISOString()
      const dedupedByDomain = new Map<string, typeof companyRows[number]>()
      const rowsWithoutDomain: typeof companyRows = []
      for (const row of companyRows) {
        const dom = normalizeDomainLocal((row as { website_raw: string | null }).website_raw)
        const enriched = { ...row, updated_at: nowIso }
        if (!dom) {
          rowsWithoutDomain.push(enriched)
        } else {
          // Last occurrence wins → most recent CRM data for that domain.
          dedupedByDomain.set(dom, enriched)
        }
      }
      const rowsToWrite = [...dedupedByDomain.values(), ...rowsWithoutDomain]

      // 4. UPSERT in batches on (user_id, normalized_domain). A re-import now
      //    UPDATES the existing company instead of creating a duplicate row.
      //    NOTE: this requires a UNIQUE constraint on
      //    (user_id, normalized_domain). Until that constraint + the dedupe of
      //    existing rows are applied (separate migration), Postgres rejects the
      //    ON CONFLICT target — so we fall back to a plain INSERT to keep
      //    imports working in the meantime.
      const BATCH = 500
      for (let i = 0; i < rowsToWrite.length; i += BATCH) {
        const slice = rowsToWrite.slice(i, i + BATCH)
        const { error: upsertErr } = await serviceClient
          .from('crm_companies')
          .upsert(slice, { onConflict: 'user_id,normalized_domain', ignoreDuplicates: false })
        if (upsertErr) {
          const noConstraint =
            upsertErr.code === '42P10' ||
            /no unique or exclusion constraint/i.test(upsertErr.message ?? '')
          if (noConstraint) {
            const { error: insErr } = await serviceClient.from('crm_companies').insert(slice)
            if (insErr) throw new Error(`Insert batch failed: ${insErr.message}`)
          } else {
            throw new Error(`Upsert batch failed: ${upsertErr.message}`)
          }
        }
      }

      // 4. Run matching
      const { data: matchData, error: matchErr } = await serviceClient.rpc('crm_run_matching', {
        p_import_id: importId,
        p_user_id: user.id,
      })

      if (matchErr) {
        throw new Error(`Matching failed: ${matchErr.message}`)
      }

      const stats = (matchData ?? {}) as Record<string, number>

      // 5. Update import
      await serviceClient
        .from('crm_imports')
        .update({
          status: 'completed',
          matched_companies_count: stats.matchedCompaniesCount ?? 0,
          unmatched_companies_count: stats.unmatchedCompaniesCount ?? 0,
        })
        .eq('id', importId)

      // 6. Enable Radar CRM emails by default for users who actually use Radar CRM.
      //    - create prefs row if missing (radar_alerts_enabled=true, radar_email_enabled=true)
      //    - if existing row and neither unsubscribed nor voluntarily disabled → enable email
      //    - never auto-reactivate users who unsubscribed or voluntarily disabled
      try {
        const { data: existingPref } = await serviceClient
          .from('crm_notification_preferences')
          .select('user_id, radar_email_enabled, radar_email_unsubscribed_at, radar_email_disabled_at')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!existingPref) {
          await serviceClient
            .from('crm_notification_preferences')
            .insert({
              user_id: user.id,
              radar_alerts_enabled: true,
              radar_email_enabled: true,
            })
        } else if (
          existingPref.radar_email_unsubscribed_at === null &&
          existingPref.radar_email_disabled_at === null &&
          existingPref.radar_email_enabled !== true
        ) {
          await serviceClient
            .from('crm_notification_preferences')
            .update({ radar_email_enabled: true, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
        }
      } catch (prefErr) {
        console.error('crm-import: failed to upsert radar email preferences:', prefErr)
        // Non-blocking — import still succeeds.
      }

      return jsonResp({
        success: true,
        importId,
        totalRows: rows.length,
        companiesImported: companyRows.length,
        matchedCompaniesCount: stats.matchedCompaniesCount ?? 0,
        unmatchedCompaniesCount: stats.unmatchedCompaniesCount ?? 0,
        matchesCount: stats.matchesCount ?? 0,
        futureMatchesCount: stats.futureMatchesCount ?? 0,
        pastMatchesCount: stats.pastMatchesCount ?? 0,
        needsReviewCount: stats.needsReviewCount ?? 0,
        qualityWarning: {
          suspiciousRate: stats.suspiciousRate ?? 0,
          threshold: 0.30,
          suspicious: (stats.suspiciousRate ?? 0) > 0.30,
          needsReviewCount: stats.needsReviewCount ?? 0,
        },
      })
    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : 'Unknown error'
      console.error('crm-import processing error:', msg)
      await serviceClient
        .from('crm_imports')
        .update({ status: 'failed', error_message: msg.slice(0, 1000) })
        .eq('id', importId)
      return jsonResp({ error: msg, importId }, 500)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('crm-import fatal:', msg)
    return jsonResp({ error: msg }, 500)
  }
})
