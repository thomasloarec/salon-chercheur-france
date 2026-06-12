import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Admin recipient for new-claim alerts (Resend via send.lotexpo.com).
const ADMIN_NOTIFICATION_EMAIL = 'admin@lotexpo.com'
// Production admin route that lists claim requests to validate/refuse.
const ADMIN_CLAIMS_URL = 'https://lotexpo.com/admin/exhibitors/claims'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Best-effort admin alert email when a claim becomes actionable (pending).
 * Sends through Resend (RESEND_API_KEY / RESEND_FROM_EMAIL -> send.lotexpo.com).
 * NEVER throws: any failure is logged and swallowed so the claim still succeeds.
 */
async function sendAdminClaimAlertEmail(params: {
  exhibitorName: string
  requesterName: string
}): Promise<void> {
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      console.error('[claim-bridge] RESEND_API_KEY missing — skipping admin alert email')
      return
    }
    const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Lotexpo <admin@lotexpo.com>'
    const safeName = escapeHtml(params.exhibitorName)
    const safeRequester = escapeHtml(params.requesterName)
    const subject = `Nouvelle revendication à valider — ${params.exhibitorName}`
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h2 style="font-size:18px;margin:0 0 16px">Nouvelle revendication à valider</h2>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
          <strong>${safeRequester}</strong> demande à revendiquer la fiche <strong>${safeName}</strong>.
          Validez ou refusez rapidement pour ne pas perdre l'élan de l'exposant.
        </p>
        <p style="margin:0 0 8px">
          <a href="${ADMIN_CLAIMS_URL}" style="display:inline-block;padding:11px 22px;background:#2563eb;color:#ffffff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600">Examiner la demande</a>
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [ADMIN_NOTIFICATION_EMAIL],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[claim-bridge] Admin alert email failed [${res.status}]:`, body.slice(0, 500))
      return
    }
    console.log(`[claim-bridge] Admin alert email sent to ${ADMIN_NOTIFICATION_EMAIL} for "${params.exhibitorName}"`)
  } catch (err) {
    console.error('[claim-bridge] Admin alert email exception:', err)
  }
}

/**
 * exhibitor-claim-bridge
 * 
 * Server-side logic for claiming an exhibitor, handling both modern and legacy cases.
 * 
 * Flow:
 * 1. Authenticate user
 * 2. If exhibitor_uuid provided → use it directly (modern path)
 * 3. If only legacy data (id_exposant, name, website) → resolve or create modern exhibitor
 *    a. Search by existing participation.exhibitor_id
 *    b. Search by normalized website domain
 *    c. Search by normalized name (exact match only)
 *    d. If no match → create minimal exhibitor + link participations
 * 4. Check for existing pending claims (dedup)
 * 5. Create claim in exhibitor_claim_requests
 * 6. Return resolved exhibitor_id
 * 
 * Anti-duplicate guards:
 * - Domain normalization (strip protocol, www, path)
 * - Name normalization (lowercase, trim, remove accents)
 * - Slug collision check before creation
 * - Advisory lock to prevent concurrent creation for same id_exposant
 */

function normalizeDomain(input: string): string {
  try {
    let s = input.trim().toLowerCase()
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '')
    s = s.split('/')[0].split('#')[0].split('?')[0]
    return s
  } catch {
    return input.trim().toLowerCase()
  }
}

function normalizeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '')    // keep only alphanumeric + space
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Sanitize an optional source_campaign_id (claim-first attribution).
 * Returns a valid existing campaign id, or null. A missing / malformed /
 * unknown value MUST degrade to null so it can never break the claim
 * (and never violates the FK on exhibitor_claim_requests.source_campaign_id).
 * Existence MUST be checked with the service-role client: outreach_campaigns
 * RLS is admin/service_role only, so the anon+JWT client would always miss.
 */
async function sanitizeSourceCampaignId(
  admin: ReturnType<typeof createClient>,
  raw: unknown,
): Promise<string | null> {
  if (typeof raw !== 'string' || !UUID_RE.test(raw.trim())) return null
  const camp = raw.trim()
  try {
    const { data } = await admin
      .from('outreach_campaigns')
      .select('id')
      .eq('id', camp)
      .maybeSingle()
    return data?.id ? camp : null
  } catch (_e) {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Authentification requise.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Utilisateur non authentifié.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Service role client for mutations ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- Parse input ---
    const body = await req.json()
    const {
      exhibitor_uuid,   // UUID if already linked to modern exhibitor
      id_exposant,      // Legacy text ID (e.g. "Exporec_123")
      name,             // Display name of the exhibitor
      website,          // Website URL
      source_campaign_id, // Optional outreach campaign id (deep-link ?camp=)
    } = body

    if (!name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'INVALID_INPUT', message: 'Le nom de l\'exposant est requis.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const trimmedName = name.trim()
    const normalizedNameStr = normalizeName(trimmedName)
    const normalizedDomainStr = website ? normalizeDomain(website) : null

    // Sanitize the attribution campaign id (format + existence). Never throws.
    const safeSourceCampaignId = await sanitizeSourceCampaignId(supabaseAdmin, source_campaign_id)

    console.log(`[claim-bridge] User ${user.id} claiming: name="${trimmedName}", id_exposant="${id_exposant}", exhibitor_uuid="${exhibitor_uuid}", domain="${normalizedDomainStr}"`)

    // ========================================
    // STEP 1: Resolve to a modern exhibitor UUID
    // ========================================
    let resolvedUUID: string | null = exhibitor_uuid || null

    // 1a. If exhibitor_uuid provided, verify it exists
    if (resolvedUUID) {
      const { data: existing } = await supabaseAdmin
        .from('exhibitors')
        .select('id')
        .eq('id', resolvedUUID)
        .maybeSingle()
      
      if (!existing) {
        console.log(`[claim-bridge] Provided exhibitor_uuid ${resolvedUUID} not found, will search`)
        resolvedUUID = null
      }
    }

    // 1b. Check if any participation with this id_exposant already has an exhibitor_id
    if (!resolvedUUID && id_exposant) {
      const { data: linkedPart } = await supabaseAdmin
        .from('participation')
        .select('exhibitor_id')
        .eq('id_exposant', id_exposant)
        .not('exhibitor_id', 'is', null)
        .limit(1)
        .maybeSingle()
      
      if (linkedPart?.exhibitor_id) {
        // Verify the exhibitor still exists
        const { data: ex } = await supabaseAdmin
          .from('exhibitors')
          .select('id')
          .eq('id', linkedPart.exhibitor_id)
          .maybeSingle()
        
        if (ex) {
          resolvedUUID = ex.id
          console.log(`[claim-bridge] Found via participation.exhibitor_id: ${resolvedUUID}`)
        }
      }
    }

    // 1c. Search by normalized website domain
    if (!resolvedUUID && normalizedDomainStr && normalizedDomainStr.length > 3) {
      const { data: candidates } = await supabaseAdmin
        .from('exhibitors')
        .select('id, website, name')
        .not('website', 'is', null)
        .limit(500)

      if (candidates) {
        const match = candidates.find(c => {
          if (!c.website) return false
          return normalizeDomain(c.website) === normalizedDomainStr
        })
        if (match) {
          resolvedUUID = match.id
          console.log(`[claim-bridge] Found via domain match: ${resolvedUUID} (${match.name})`)
        }
      }
    }

    // 1d. Search by normalized name (exact match only, very conservative)
    if (!resolvedUUID && normalizedNameStr.length >= 3) {
      const { data: candidates } = await supabaseAdmin
        .from('exhibitors')
        .select('id, name, website')
        .ilike('name', trimmedName)
        .limit(5)

      if (candidates && candidates.length === 1) {
        // Only use if exactly one match (avoid ambiguity)
        resolvedUUID = candidates[0].id
        console.log(`[claim-bridge] Found via exact name match: ${resolvedUUID} (${candidates[0].name})`)
      } else if (candidates && candidates.length > 1) {
        // Multiple matches — try to narrow by domain if available
        if (normalizedDomainStr) {
          const domainMatch = candidates.find(c =>
            c.website && normalizeDomain(c.website) === normalizedDomainStr
          )
          if (domainMatch) {
            resolvedUUID = domainMatch.id
            console.log(`[claim-bridge] Resolved ambiguous name via domain: ${resolvedUUID}`)
          }
        }
        // If still ambiguous, don't auto-match — create a new one
        if (!resolvedUUID) {
          console.log(`[claim-bridge] Multiple name matches (${candidates.length}), creating new exhibitor to be safe`)
        }
      }
    }

    // ========================================
    // STEP 2: Create modern exhibitor if needed
    // ========================================
    // STEP 1e: Consult existing public identities (anti-duplicate hardening — FIX 2a)
    // If a public identity already exists for this legacy page, never create a
    // second modern record. Reuse the linked exhibitor when present; otherwise
    // remember the orphan identity (exhibitor_id NULL) to attach it after create.
    let orphanIdentityId: string | null = null
    if (!resolvedUUID && id_exposant) {
      const { data: identities } = await supabaseAdmin
        .from('exhibitor_public_identities')
        .select('id, exhibitor_id')
        .eq('legacy_exposant_id', id_exposant)
        .limit(1)

      const identity = identities?.[0]
      if (identity) {
        if (identity.exhibitor_id) {
          resolvedUUID = identity.exhibitor_id as string
          console.log(`[claim-bridge] Found via public identity (legacy_exposant_id=${id_exposant}): ${resolvedUUID}`)
        } else {
          orphanIdentityId = identity.id as string
          console.log(`[claim-bridge] Found orphan public identity ${orphanIdentityId} (exhibitor_id NULL) — will attach after create`)
        }
      }
    }

    if (!resolvedUUID) {
      console.log(`[claim-bridge] Creating new exhibitor: "${trimmedName}"`)

      // Generate a slug
      let baseSlug = trimmedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      let finalSlug = baseSlug
      let slugCounter = 0

      // Check slug uniqueness
      while (true) {
        const { data: slugCheck } = await supabaseAdmin
          .from('exhibitors')
          .select('id')
          .eq('slug', finalSlug)
          .maybeSingle()
        
        if (!slugCheck) break
        slugCounter++
        finalSlug = `${baseSlug}-${slugCounter}`
      }

      const { data: newExhibitor, error: createError } = await supabaseAdmin
        .from('exhibitors')
        .insert({
          name: trimmedName,
          slug: finalSlug,
          website: website || null,
          description: null,
          approved: false,
          is_test: false,
          plan: 'free',
        })
        .select('id')
        .single()

      if (createError) {
        console.error(`[claim-bridge] Error creating exhibitor:`, createError)
        return new Response(
          JSON.stringify({ error: 'CREATE_FAILED', message: 'Erreur lors de la création du profil exposant.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      resolvedUUID = newExhibitor.id
      console.log(`[claim-bridge] Created exhibitor: ${resolvedUUID} slug="${finalSlug}"`)

      // Link all participation records with this id_exposant to the new exhibitor
      if (id_exposant) {
        const { data: updated, error: linkError } = await supabaseAdmin
          .from('participation')
          .update({ exhibitor_id: resolvedUUID })
          .eq('id_exposant', id_exposant)
          .is('exhibitor_id', null)
          .select('id_participation')

        if (linkError) {
          console.error(`[claim-bridge] Error linking participations:`, linkError)
        } else {
          console.log(`[claim-bridge] Linked ${updated?.length || 0} participations to ${resolvedUUID}`)
        }
      }

      // ====================================================================
      // FIX 2b: ensure the new modern record has a resolvable public_slug.
      // ensure_exhibitor_public_identity does NOT reconcile an orphan legacy
      // identity (it early-returns by legacy_exposant_id without linking, or
      // creates a colliding 'modern' slug) -> Option 1: attach explicitly.
      // ====================================================================
      if (orphanIdentityId) {
        const { error: attachError } = await supabaseAdmin
          .from('exhibitor_public_identities')
          .update({ exhibitor_id: resolvedUUID, source_type: 'linked' })
          .eq('id', orphanIdentityId)
          .is('exhibitor_id', null)
        if (attachError) {
          console.error(`[claim-bridge] Error attaching public identity:`, attachError)
        } else {
          console.log(`[claim-bridge] Attached public identity ${orphanIdentityId} -> ${resolvedUUID}`)
        }
      } else {
        // No pre-existing identity -> generate one centrally (keeps logic in the function).
        const { error: ensureError } = await supabaseAdmin
          .rpc('ensure_exhibitor_public_identity', { p_exhibitor_id: resolvedUUID })
        if (ensureError) {
          console.error(`[claim-bridge] Error ensuring public identity:`, ensureError)
        } else {
          console.log(`[claim-bridge] Ensured public identity for ${resolvedUUID}`)
        }
      }
    }

    // ========================================
    // STEP 3: Detect existing claim (ANY status)
    // ========================================
    // An existing claim row (pending/approved/rejected) must NOT trigger a blind
    // INSERT — that violates UNIQUE (exhibitor_id, requester_user_id) -> 500 (bug 4).
    // We only short-circuit when the user already owns it (approved) to avoid
    // downgrading; pending/rejected are refreshed to pending via UPSERT below.
    const { data: existingClaim } = await supabaseAdmin
      .from('exhibitor_claim_requests')
      .select('id, status')
      .eq('exhibitor_id', resolvedUUID)
      .eq('requester_user_id', user.id)
      .maybeSingle()

    if (existingClaim?.status === 'approved') {
      console.log(`[claim-bridge] User already owns this exhibitor (approved claim ${existingClaim.id})`)
      return new Response(
        JSON.stringify({
          success: true,
          exhibitor_id: resolvedUUID,
          claim_id: existingClaim.id,
          already_approved: true,
          message: 'Vous gérez déjà cette entreprise.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const wasPending = existingClaim?.status === 'pending'

    // ========================================
    // STEP 4: Create or refresh the claim (UPSERT — FIX 1, bug 4)
    // ========================================
    // On conflict with an existing (rejected/pending) row: reset to 'pending',
    // refresh attribution + created_at. source_campaign_id keeps the existing
    // sanitization (format + existence via service_role -> null otherwise).
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('exhibitor_claim_requests')
      .upsert(
        {
          exhibitor_id: resolvedUUID,
          requester_user_id: user.id,
          status: 'pending',
          source_campaign_id: safeSourceCampaignId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'exhibitor_id,requester_user_id' }
      )
      .select('id')
      .single()

    if (claimError) {
      console.error(`[claim-bridge] Error upserting claim:`, claimError)
      return new Response(
        JSON.stringify({ error: 'CLAIM_FAILED', message: 'Erreur lors de la création de la demande.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[claim-bridge] Claim upserted: ${claim.id} for exhibitor ${resolvedUUID} (wasPending=${wasPending})`)

    return new Response(
      JSON.stringify({
        success: true,
        exhibitor_id: resolvedUUID,
        claim_id: claim.id,
        already_pending: wasPending,
        message: wasPending
          ? 'Vous aviez déjà une demande en cours ; elle a été actualisée.'
          : 'Votre demande a bien été envoyée.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[claim-bridge] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Une erreur inattendue est survenue.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
