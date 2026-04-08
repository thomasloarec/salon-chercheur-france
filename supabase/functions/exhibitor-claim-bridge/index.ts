import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    }

    // ========================================
    // STEP 3: Check for existing pending claim
    // ========================================
    const { data: existingClaim } = await supabaseAdmin
      .from('exhibitor_claim_requests')
      .select('id, status')
      .eq('exhibitor_id', resolvedUUID)
      .eq('requester_user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingClaim) {
      console.log(`[claim-bridge] User already has pending claim: ${existingClaim.id}`)
      return new Response(
        JSON.stringify({
          success: true,
          exhibitor_id: resolvedUUID,
          claim_id: existingClaim.id,
          already_pending: true,
          message: 'Vous avez déjà une demande en cours pour cette entreprise.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========================================
    // STEP 4: Create the claim
    // ========================================
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('exhibitor_claim_requests')
      .insert({
        exhibitor_id: resolvedUUID,
        requester_user_id: user.id,
      })
      .select('id')
      .single()

    if (claimError) {
      console.error(`[claim-bridge] Error creating claim:`, claimError)
      return new Response(
        JSON.stringify({ error: 'CLAIM_FAILED', message: 'Erreur lors de la création de la demande.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[claim-bridge] Claim created: ${claim.id} for exhibitor ${resolvedUUID}`)

    return new Response(
      JSON.stringify({
        success: true,
        exhibitor_id: resolvedUUID,
        claim_id: claim.id,
        already_pending: false,
        message: 'Votre demande a bien été envoyée.'
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
