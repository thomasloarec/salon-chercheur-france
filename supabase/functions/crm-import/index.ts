import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_ROWS = 5000

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

      // 3. Insert in batches
      const BATCH = 500
      for (let i = 0; i < companyRows.length; i += BATCH) {
        const slice = companyRows.slice(i, i + BATCH)
        const { error: insErr } = await serviceClient.from('crm_companies').insert(slice)
        if (insErr) {
          throw new Error(`Insert batch failed: ${insErr.message}`)
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
