import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().slice(0, 8)
  try {
    const authHeader = req.headers.get('Authorization')
    let requestData: Record<string, any> = {}

    if (req.method === 'POST') {
      try {
        requestData = await req.json()
      } catch (parseError) {
        console.error('❌ Failed to parse request body:', parseError)
        return jsonError('Invalid JSON body', 400)
      }
    }

    const action = typeof requestData?.action === 'string' ? requestData.action : undefined

    console.log('🟢 exhibitors-manage called', {
      method: req.method,
      action: action ?? 'NO_ACTION',
      hasAuth: !!authHeader,
      timestamp: new Date().toISOString(),
    })

    // ── Auth client: used ONLY to verify the caller's identity ──
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: {
          headers: authHeader ? { Authorization: authHeader } : {}
        }
      }
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔑 JWT verified', {
      userId: user?.id ?? 'NONE',
      action,
    })

    // ── Service client: used for all DB writes (bypasses RLS) ──
    // All authorization checks are done explicitly in code below.
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    )

    let isAdmin = false
    try {
      const { data: isAdminData, error: isAdminError } = await serviceClient.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      })
      if (isAdminError) {
        console.error('❌ is_admin RPC error:', isAdminError)
      }
      isAdmin = !!isAdminData
    } catch (err) {
      console.error('❌ is_admin RPC exception:', err)
      isAdmin = false
    }

    console.log('🔐 is_admin result', {
      isAdmin,
      userId: user?.id,
      action,
    })

    if (req.method !== 'POST') {
      // GET handler for exhibitor lists (read-only, uses auth client for RLS)
      if (req.method === 'GET') {
        const url = new URL(req.url)
        const eventId = url.searchParams.get('event_id')
        const search = url.searchParams.get('q')

        if (!eventId) {
          return jsonError('event_id is required', 400)
        }

        let query = authClient
          .from('exhibitors')
          .select(`id, name, slug, logo_url, participation!inner(stand_exposant, urlexpo_event)`)
          .eq('participation.id_event', eventId)

        if (search) {
          query = query.ilike('name', `%${search}%`)
        }
        query = query.order('name')

        const { data: exhibitors, error } = await query
        if (error) {
          console.error('Error fetching exhibitors:', error)
          return jsonError('Failed to fetch exhibitors', 500)
        }

        return jsonOk(exhibitors || [])
      }

      return jsonError('Method not allowed', 405)
    }

    // ── POST actions ──

    // ────────────────────────────────────────────────────
    // ACTION: list
    // ────────────────────────────────────────────────────
    if (action === 'list') {
      const { event_id, search } = requestData

      if (!event_id) {
        return jsonError('event_id is required', 400)
      }

      const { data: participations, error } = await authClient
        .from('participation')
        .select(`
          exhibitors!inner(
            id, name, website, logo_url, approved, stand_info
          )
        `)
        .eq('id_event', event_id)

      if (error) {
        return jsonError('Failed to fetch exhibitors', 500)
      }

      let exhibitors = (participations || [])
        .map((p: any) => p.exhibitors)
        .filter(Boolean)
        .flat()

      if (search && search.trim()) {
        const searchLower = search.toLowerCase()
        exhibitors = exhibitors.filter((e: any) =>
          e.name.toLowerCase().includes(searchLower) ||
          (e.website && e.website.toLowerCase().includes(searchLower))
        )
      }

      exhibitors.sort((a: any, b: any) => a.name.localeCompare(b.name))
      return jsonOk(exhibitors)
    }

    // ────────────────────────────────────────────────────
    // ACTION: create
    // Uses serviceClient to bypass RLS (auth already verified above)
    // ────────────────────────────────────────────────────
    if (action === 'create') {
      const { name, website, description, stand_info, logo_url, event_id, defer_participation } = requestData

      if (!name || !event_id) {
        return jsonError('name and event_id are required', 400)
      }

      // ── Helper: normalise un site web pour comparaison stricte de domaine ──
      const normaliseWebsite = (raw: string | null | undefined): string | null => {
        if (!raw) return null
        try {
          const trimmed = String(raw).trim()
          if (!trimmed) return null
          const withProtocol = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
          return new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase()
        } catch {
          return null
        }
      }

      // ── DEDUP : si le site web fourni correspond à un exposant déjà existant,
      //   on réutilise cet exposant au lieu d'en créer un doublon. ──
      const submittedDomain = normaliseWebsite(website)
      let newExhibitor: any = null
      let reusedExisting = false

      if (submittedDomain) {
        const { data: candidates } = await serviceClient
          .from('exhibitors')
          .select('id, name, website, logo_url, approved, stand_info, owner_user_id')
          .not('website', 'is', null)

        const match = (candidates || []).find(
          (e: any) => normaliseWebsite(e.website) === submittedDomain
        )
        if (match) {
          console.log('♻️ Exposant déjà existant pour ce domaine, réutilisation:', match.id)
          newExhibitor = match
          reusedExisting = true
        }
      }

      // STEP 1: Create modern exhibitor (uniquement si aucun doublon trouvé)
      if (!newExhibitor) {
        const { data: created, error: createError } = await serviceClient
          .from('exhibitors')
          .insert({
            name,
            website: website || null,
            description: description || null,
            stand_info: stand_info || null,
            logo_url: logo_url || null,
            approved: false,
            owner_user_id: user.id
          })
          .select()
          .single()

        if (createError || !created) {
          console.error('❌ Failed to create exhibitor:', createError)
          return jsonError('Failed to create exhibitor', 500, createError)
        }

        newExhibitor = created
        console.log('✅ Exhibitor created:', newExhibitor.id)
      }


      // STEP 2: Create legacy entry in exposants (idempotent)
      {
        const { data: existingLegacy } = await serviceClient
          .from('exposants')
          .select('id_exposant')
          .eq('id_exposant', newExhibitor.id)
          .maybeSingle()

        if (!existingLegacy) {
          const { error: legacyError } = await serviceClient
            .from('exposants')
            .insert({
              id_exposant: newExhibitor.id,
              nom_exposant: newExhibitor.name || name,
              website_exposant: newExhibitor.website || website || null,
              exposant_description: description || null
            })

          if (legacyError) {
            console.error('⚠️ Failed to create legacy exposant:', legacyError)
          } else {
            console.log('✅ Legacy exposant created with id:', newExhibitor.id)
          }
        } else {
          console.log('↪️ Legacy exposant already present, skip insert')
        }
      }

      // STEP 3: Create participation (unless deferred) — idempotent par (event_id, id_exposant)
      if (!defer_participation) {
        const { data: eventData } = await serviceClient
          .from('events')
          .select('id_event')
          .eq('id', event_id)
          .single()

        // Vérifier si une participation existe déjà pour cet exposant + événement
        const { data: existingParticipation } = await serviceClient
          .from('participation')
          .select('id_participation')
          .eq('id_exposant', newExhibitor.id)
          .eq('id_event', event_id)
          .maybeSingle()

        if (!existingParticipation) {
          const { error: participationError } = await serviceClient
            .from('participation')
            .insert({
              id_exposant: newExhibitor.id,
              exhibitor_id: newExhibitor.id,
              id_event: event_id,
              id_event_text: eventData?.id_event || null,
              website_exposant: newExhibitor.website || website || null,
              stand_exposant: stand_info || newExhibitor.stand_info || null,
              urlexpo_event: null
            })

          if (participationError) {
            console.error('❌ Failed to create participation:', participationError)
            return jsonError('Exhibitor created but participation failed', 500, participationError)
          }

          console.log('✅ Participation created for event:', event_id)
        } else {
          console.log('↪️ Participation already exists for this event, skip insert')
        }
      } else {
        console.log('⏸️ Participation deferred')
      }

      // STEP 4: Auto-approve claim if email domain matches website domain
      let claimStatus = 'pending'
      let teamPromoted = false
      if (website && user.email) {
        const userDomain = user.email.split('@')[1]?.toLowerCase()
        try {
          const websiteDomain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '').toLowerCase()
          if (userDomain && websiteDomain && userDomain === websiteDomain) {
            claimStatus = 'approved'
            await serviceClient
              .from('exhibitors')
              .update({ approved: true })
              .eq('id', newExhibitor.id)

            // Auto-promote as owner (guard: no existing active owner)
            const { data: existingOwner } = await serviceClient
              .from('exhibitor_team_members')
              .select('id')
              .eq('exhibitor_id', newExhibitor.id)
              .eq('role', 'owner')
              .eq('status', 'active')
              .maybeSingle()

            if (!existingOwner) {
              const { error: teamError } = await serviceClient
                .from('exhibitor_team_members')
                .insert({
                  exhibitor_id: newExhibitor.id,
                  user_id: user.id,
                  role: 'owner',
                  status: 'active'
                })
              if (!teamError) {
                teamPromoted = true
                await serviceClient
                  .from('exhibitors')
                  .update({ verified_at: new Date().toISOString() })
                  .eq('id', newExhibitor.id)
              }
            }
          }
        } catch {
          // Invalid URL, skip auto-approve
        }
      }

      // Create claim request
      await serviceClient
        .from('exhibitor_claim_requests')
        .insert({
          exhibitor_id: newExhibitor.id,
          requester_user_id: user.id,
          status: claimStatus
        })

      return jsonOk({
        ...newExhibitor,
        approved: claimStatus === 'approved',
        team_promoted: teamPromoted,
        participation_deferred: !!defer_participation
      })
    }

    // ────────────────────────────────────────────────────
    // ACTION: approve_claim (admin only)
    // ────────────────────────────────────────────────────
    if (action === 'approve_claim') {
      if (!isAdmin) {
        return jsonError('Admin access required', 403)
      }

      const { request_id } = requestData
      if (!request_id) {
        return jsonError('request_id is required', 400)
      }

      // Fetch the claim request
      const { data: claimRequest, error: fetchError } = await serviceClient
        .from('exhibitor_claim_requests')
        .select('id, exhibitor_id, requester_user_id, status')
        .eq('id', request_id)
        .single()

      if (fetchError || !claimRequest) {
        return jsonError('Claim request not found', 404)
      }

      if (claimRequest.status !== 'pending') {
        return jsonError(`Claim already processed (status: ${claimRequest.status})`, 400)
      }

      // Update claim status to approved
      const { error: updateClaimError } = await serviceClient
        .from('exhibitor_claim_requests')
        .update({ status: 'approved' })
        .eq('id', request_id)

      if (updateClaimError) {
        console.error('❌ Failed to update claim status:', updateClaimError)
        return jsonError('Failed to approve claim', 500)
      }

      // Set owner_user_id and approved on the exhibitor
      const { error: updateExhibitorError } = await serviceClient
        .from('exhibitors')
        .update({
          owner_user_id: claimRequest.requester_user_id,
          approved: true
        })
        .eq('id', claimRequest.exhibitor_id)

      if (updateExhibitorError) {
        console.error('❌ Failed to update exhibitor owner:', updateExhibitorError)
        return jsonError('Claim approved but exhibitor update failed', 500)
      }

      // ── BLOC A: Team auto-promotion ──
      let teamPromoted = false
      let verifiedAtSet = false

      // Check if an active owner already exists
      const { data: existingOwner } = await serviceClient
        .from('exhibitor_team_members')
        .select('id')
        .eq('exhibitor_id', claimRequest.exhibitor_id)
        .eq('role', 'owner')
        .eq('status', 'active')
        .maybeSingle()

      if (!existingOwner) {
        // Check if requester already has a team membership (any role/status)
        const { data: existingMembership } = await serviceClient
          .from('exhibitor_team_members')
          .select('id')
          .eq('exhibitor_id', claimRequest.exhibitor_id)
          .eq('user_id', claimRequest.requester_user_id)
          .maybeSingle()

        let teamError = null

        if (existingMembership) {
          // Update existing membership to owner + active
          const res = await serviceClient
            .from('exhibitor_team_members')
            .update({ role: 'owner', status: 'active', invited_by: user.id, updated_at: new Date().toISOString() })
            .eq('id', existingMembership.id)
          teamError = res.error
        } else {
          // Insert new team member as owner
          const res = await serviceClient
            .from('exhibitor_team_members')
            .insert({
              exhibitor_id: claimRequest.exhibitor_id,
              user_id: claimRequest.requester_user_id,
              role: 'owner',
              status: 'active',
              invited_by: user.id
            })
          teamError = res.error
        }

        if (teamError) {
          console.error('⚠️ Failed to upsert team member:', teamError)
        } else {
          teamPromoted = true
          console.log('✅ Team owner created/updated:', claimRequest.requester_user_id)

          // Set verified_at only when promotion actually happened
          const { error: verifyError } = await serviceClient
            .from('exhibitors')
            .update({ verified_at: new Date().toISOString() })
            .eq('id', claimRequest.exhibitor_id)

          if (!verifyError) {
            verifiedAtSet = true
          }
        }
      } else {
        // Owner exists, but still add requester as admin team member
        const { data: existingMembership } = await serviceClient
          .from('exhibitor_team_members')
          .select('id')
          .eq('exhibitor_id', claimRequest.exhibitor_id)
          .eq('user_id', claimRequest.requester_user_id)
          .maybeSingle()

        if (!existingMembership) {
          await serviceClient
            .from('exhibitor_team_members')
            .insert({
              exhibitor_id: claimRequest.exhibitor_id,
              user_id: claimRequest.requester_user_id,
              role: 'admin',
              status: 'active',
              invited_by: user.id
            })
          console.log('✅ Requester added as admin (owner already exists):', claimRequest.requester_user_id)
        }
        teamPromoted = true
      }

      console.log('✅ Claim approved:', request_id, '→ exhibitor:', claimRequest.exhibitor_id, '→ owner:', claimRequest.requester_user_id, '→ teamPromoted:', teamPromoted)

      return jsonOk({
        status: 'approved',
        exhibitor_id: claimRequest.exhibitor_id,
        owner_user_id: claimRequest.requester_user_id,
        team_promoted: teamPromoted,
        verified_at_set: verifiedAtSet
      })
    }

    // ────────────────────────────────────────────────────
    // ACTION: reject_claim (admin only)
    // ────────────────────────────────────────────────────
    if (action === 'reject_claim') {
      if (!isAdmin) {
        return jsonError('Admin access required', 403)
      }

      const { request_id } = requestData
      if (!request_id) {
        return jsonError('request_id is required', 400)
      }

      // Fetch the claim request
      const { data: claimRequest, error: fetchError } = await serviceClient
        .from('exhibitor_claim_requests')
        .select('id, status')
        .eq('id', request_id)
        .single()

      if (fetchError || !claimRequest) {
        return jsonError('Claim request not found', 404)
      }

      if (claimRequest.status !== 'pending') {
        return jsonError(`Claim already processed (status: ${claimRequest.status})`, 400)
      }

      // Update claim status to rejected
      const { error: updateError } = await serviceClient
        .from('exhibitor_claim_requests')
        .update({ status: 'rejected' })
        .eq('id', request_id)

      if (updateError) {
        console.error('❌ Failed to reject claim:', updateError)
        return jsonError('Failed to reject claim', 500)
      }

      console.log('✅ Claim rejected:', request_id)

      return jsonOk({ status: 'rejected' })
    }

    // ────────────────────────────────────────────────────
    // ACTION: update (any active team member or site admin)
    // ────────────────────────────────────────────────────
    if (action === 'update') {
      const { exhibitor_id, description, logo_url } = requestData

      if (!exhibitor_id) {
        return jsonError('exhibitor_id is required', 400)
      }

      if (!isAdmin) {
        // Allow any active team member to update description
        const { data: membership } = await serviceClient
          .from('exhibitor_team_members')
          .select('id, role')
          .eq('exhibitor_id', exhibitor_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (!membership) {
          return jsonError('Not authorized to update this exhibitor', 403)
        }
      }

      const updateData: Record<string, unknown> = {}
      if (description !== undefined) updateData.description = description
      if (logo_url !== undefined) updateData.logo_url = logo_url

      if (Object.keys(updateData).length === 0) {
        return jsonError('No fields to update', 400)
      }

      const { data: updatedExhibitor, error: updateError } = await serviceClient
        .from('exhibitors')
        .update(updateData)
        .eq('id', exhibitor_id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating exhibitor:', updateError)
        return jsonError('Failed to update exhibitor', 500)
      }

      return jsonOk(updatedExhibitor)
    }

    const resolveUserByEmail = async (
      serviceClient: any,
      userEmail: string,
    ): Promise<{ id: string; email: string } | null> => {
      const normalizedEmail = userEmail.trim().toLowerCase()
      const { data, error } = await serviceClient.rpc('get_user_id_by_email', {
        p_email: normalizedEmail,
      })

      if (error) {
        console.error('❌ resolveUserByEmail rpc error', {
          user_email: normalizedEmail,
          message: error.message,
          code: error.code,
        })
        throw error
      }

      if (!data) return null
      return { id: data, email: normalizedEmail }
    }

    // ────────────────────────────────────────────────────
    // ACTION: owner_add_member (owner of the exhibitor)
    // ────────────────────────────────────────────────────
    if (action === 'owner_add_member') {
      console.log('🏠 owner_add_member handler entered', {
        exhibitor_id: requestData?.exhibitor_id,
        user_email: requestData?.user_email,
        callerId: user?.id,
      })

      const { exhibitor_id, user_email, role = 'admin' } = requestData

      if (!exhibitor_id || !user_email) {
        return jsonError('Missing exhibitor_id or user_email', 400)
      }

      let callerIsOwner = false
      try {
        if (!isAdmin) {
          const { data: ownerCheck, error: ownerError } = await serviceClient
            .from('exhibitor_team_members')
            .select('id')
            .eq('exhibitor_id', exhibitor_id)
            .eq('user_id', user.id)
            .eq('role', 'owner')
            .eq('status', 'active')
            .maybeSingle()

          if (ownerError) {
            console.error('❌ owner_add_member: owner check error', ownerError)
            return jsonError('Authorization check failed', 500)
          }

          callerIsOwner = !!ownerCheck
        } else {
          callerIsOwner = true
        }

        console.log('✅ owner_add_member: auth check done', { callerIsOwner, isAdmin })
      } catch (err) {
        console.error('❌ owner_add_member: auth check exception', err)
        return jsonError('Authorization check failed', 500)
      }

      if (!callerIsOwner) {
        return jsonError('Unauthorized: must be owner of this exhibitor', 403)
      }

      let exhibitorName = 'votre entreprise'
      try {
        const { data: exhibitor, error: exError } = await serviceClient
          .from('exhibitors')
          .select('name')
          .eq('id', exhibitor_id)
          .single()

        if (exError) {
          console.error('❌ owner_add_member: exhibitor fetch error', exError)
        } else {
          exhibitorName = exhibitor?.name ?? exhibitorName
        }

        console.log('✅ owner_add_member: exhibitor fetched', { exhibitorName })
      } catch (err) {
        console.error('❌ owner_add_member: exhibitor fetch exception', err)
      }

      let inviterName = 'Un gestionnaire'
      try {
        const { data: inviterProfile, error: inviterError } = await serviceClient
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .single()

        if (inviterError) {
          console.error('❌ owner_add_member: inviter fetch error', inviterError)
        } else if (inviterProfile) {
          inviterName = `${inviterProfile.first_name || ''} ${inviterProfile.last_name || ''}`.trim() || inviterName
        }
      } catch (err) {
        console.error('❌ owner_add_member: inviter fetch exception', err)
      }

      let matchedUser: { id: string; email: string } | null = null
      try {
        console.log('🔍 owner_add_member: resolving user by email', { user_email })
        matchedUser = await resolveUserByEmail(serviceClient, user_email)
        console.log('🔍 owner_add_member: user resolved', {
          found: !!matchedUser,
          userId: matchedUser?.id ?? null,
        })
      } catch (err) {
        console.error('❌ owner_add_member: resolveUserByEmail exception', err)
        return jsonError('User lookup failed', 500)
      }

      const siteUrl = Deno.env.get('SITE_URL') || 'https://lotexpo.com'

      if (matchedUser) {
        try {
          const { data: existingMembership, error: membershipLookupError } = await serviceClient
            .from('exhibitor_team_members')
            .select('id, status')
            .eq('exhibitor_id', exhibitor_id)
            .eq('user_id', matchedUser.id)
            .maybeSingle()

          if (membershipLookupError) {
            console.error('❌ owner_add_member: membership lookup error', membershipLookupError)
            return jsonError('Failed to inspect team member', 500)
          }

          if (existingMembership?.status === 'active') {
            return jsonError('Cet utilisateur est déjà membre', 400)
          }

          if (existingMembership) {
            const { error: updateError } = await serviceClient
              .from('exhibitor_team_members')
              .update({
                role,
                status: 'active',
                invited_by: user.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingMembership.id)

            if (updateError) {
              console.error('❌ owner_add_member: update team member error', updateError)
              return jsonError('Failed to add team member', 500)
            }
          } else {
            const { error: insertError } = await serviceClient
              .from('exhibitor_team_members')
              .insert({
                exhibitor_id,
                user_id: matchedUser.id,
                role,
                status: 'active',
                invited_by: user.id,
              })

            if (insertError) {
              console.error('❌ owner_add_member: insert team member error', insertError)
              return jsonError('Failed to add team member', 500)
            }
          }

          console.log('✅ owner_add_member: team member inserted', {
            userId: matchedUser.id,
            role,
          })
        } catch (err) {
          console.error('❌ owner_add_member: insert team member exception', err)
          return jsonError('Failed to add team member', 500)
        }

        const emailResult = await sendExhibitorEmail({
          to: user_email,
          subject: `Vous avez été ajouté comme gestionnaire de ${exhibitorName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1a1a1a; font-size: 24px; text-align: center;">Bienvenue dans l'équipe ${exhibitorName}</h1>
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> vous a ajouté comme ${role} de la société <strong>${exhibitorName}</strong> sur Lotexpo.
              </p>
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                Retrouvez vos entreprises depuis votre espace profil.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${siteUrl}/profile" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">Accéder à mon espace</a>
              </div>
            </div>
          `,
        })

        console.log('📧 owner_add_member email result:', {
          success: emailResult.success,
          status: emailResult.status,
          error: emailResult.error,
        })

        return jsonOk({
          status: 'added',
          user_id: matchedUser.id,
          email_sent: emailResult.success,
          ...(emailResult.success ? {} : { email_warning: emailResult.error }),
        })
      }

      try {
        const { data: existingInvite, error: existingInviteError } = await serviceClient
          .from('exhibitor_invitations')
          .select('id')
          .eq('email', user_email.toLowerCase())
          .eq('exhibitor_id', exhibitor_id)
          .eq('status', 'pending')
          .maybeSingle()

        if (existingInviteError) {
          console.error('❌ owner_add_member: existing invitation lookup error', existingInviteError)
          return jsonError('Failed to inspect invitation', 500)
        }

        if (existingInvite) {
          return jsonError('Une invitation est déjà en attente pour cet email', 400)
        }

        const token = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

        const { error: inviteError } = await serviceClient
          .from('exhibitor_invitations')
          .insert({
            email: user_email.toLowerCase(),
            exhibitor_id,
            invited_by: user.id,
            role,
            token,
            status: 'pending',
            expires_at: expiresAt,
          })

        if (inviteError) {
          console.error('❌ owner_add_member: insert invitation error', inviteError)
          return jsonError('Failed to create invitation', 500)
        }

        console.log('✅ owner_add_member: invitation inserted', { token })

        const inviteUrl = `${siteUrl}/auth?invite=${token}&email=${encodeURIComponent(user_email)}`
        const emailResult = await sendExhibitorEmail({
          to: user_email,
          subject: `Invitation à gérer ${exhibitorName} sur Lotexpo`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1a1a1a; font-size: 24px; text-align: center;">Vous avez été invité sur Lotexpo</h1>
              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> vous a invité à devenir ${role} de <strong>${exhibitorName}</strong>.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">Créer mon compte et rejoindre l'équipe</a>
              </div>
              <p style="color: #888; font-size: 13px;">Lien valable 7 jours.</p>
            </div>
          `,
        })

        console.log('📧 owner_add_member email result:', {
          success: emailResult.success,
          status: emailResult.status,
          error: emailResult.error,
        })

        return jsonOk({
          status: 'invited',
          email: user_email,
          email_sent: emailResult.success,
          ...(emailResult.success ? {} : { email_warning: emailResult.error }),
        })
      } catch (err) {
        console.error('❌ owner_add_member: invitation flow exception', err)
        return jsonError('Failed to create invitation', 500)
      }
    }

    // ────────────────────────────────────────────────────
    // ACTION: accept_invite (called after signup/login)
    // ────────────────────────────────────────────────────
    if (action === 'accept_invite') {
      const { token } = requestData
      if (!token) return jsonError('token required', 400)

      // Find pending invitation
      const { data: invitation, error: invFindErr } = await serviceClient
        .from('exhibitor_invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .maybeSingle()

      if (invFindErr || !invitation) {
        return jsonOk({ status: 'no_invitation' }) // silent fail — token might be expired or already used
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        await serviceClient
          .from('exhibitor_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id)
        return jsonOk({ status: 'expired' })
      }

      // Check user email matches invitation
      const userEmail = user.email?.toLowerCase()
      if (userEmail !== invitation.email.toLowerCase()) {
        return jsonOk({ status: 'email_mismatch' })
      }

      // Check for existing membership
      const { data: existingMember } = await serviceClient
        .from('exhibitor_team_members')
        .select('id')
        .eq('exhibitor_id', invitation.exhibitor_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (!existingMember) {
        // Add user to team
        await serviceClient
          .from('exhibitor_team_members')
          .insert({
            exhibitor_id: invitation.exhibitor_id,
            user_id: user.id,
            role: invitation.role || 'admin',
            status: 'active',
            invited_by: invitation.invited_by,
          })
      }

      // Mark invitation as accepted
      await serviceClient
        .from('exhibitor_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      return jsonOk({ status: 'accepted', exhibitor_id: invitation.exhibitor_id })
    }

    // ────────────────────────────────────────────────────
    // ACTION: check_pending_invites (called on login, matches by email)
    // ────────────────────────────────────────────────────
    if (action === 'check_pending_invites') {
      const userEmail = user.email?.toLowerCase()
      if (!userEmail) return jsonOk({ accepted: 0 })

      const { data: pendingInvites, error: pendingErr } = await serviceClient
        .from('exhibitor_invitations')
        .select('id, exhibitor_id, role, invited_by, expires_at')
        .eq('email', userEmail)
        .eq('status', 'pending')

      if (pendingErr || !pendingInvites?.length) {
        return jsonOk({ accepted: 0 })
      }

      let accepted = 0
      for (const inv of pendingInvites) {
        if (new Date(inv.expires_at) < new Date()) {
          await serviceClient.from('exhibitor_invitations').update({ status: 'expired' }).eq('id', inv.id)
          continue
        }

        const { data: existing } = await serviceClient
          .from('exhibitor_team_members')
          .select('id')
          .eq('exhibitor_id', inv.exhibitor_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (!existing) {
          await serviceClient.from('exhibitor_team_members').insert({
            exhibitor_id: inv.exhibitor_id,
            user_id: user.id,
            role: inv.role || 'admin',
            status: 'active',
            invited_by: inv.invited_by,
          })
        }

        await serviceClient.from('exhibitor_invitations')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', inv.id)
        accepted++
      }

      console.log(`✅ check_pending_invites: accepted ${accepted} invitations for ${userEmail}`)
      return jsonOk({ accepted })
    }

    // ────────────────────────────────────────────────────
    if (action === 'owner_remove_member') {
      const { exhibitor_id, membership_id } = requestData
      if (!exhibitor_id || !membership_id) return jsonError('exhibitor_id and membership_id required', 400)

      // Verify caller is owner
      if (!isAdmin) {
        const { data: callerMembership } = await serviceClient
          .from('exhibitor_team_members')
          .select('id, role')
          .eq('exhibitor_id', exhibitor_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .eq('role', 'owner')
          .maybeSingle()

        if (!callerMembership) {
          return jsonError('Seul le propriétaire peut retirer des collaborateurs', 403)
        }
      }

      // Don't allow removing yourself as owner
      const { data: targetMember } = await serviceClient
        .from('exhibitor_team_members')
        .select('id, user_id, role')
        .eq('id', membership_id)
        .single()

      if (!targetMember) return jsonError('Membre non trouvé', 404)
      if (targetMember.role === 'owner') return jsonError('Impossible de retirer le propriétaire', 400)

      const { error } = await serviceClient
        .from('exhibitor_team_members')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', membership_id)

      if (error) return jsonError('Failed to remove member', 500)
      return jsonOk({ status: 'removed' })
    }

    // ────────────────────────────────────────────────────
    // ACTION: owner_get_team (owner or admin team member)
    // ────────────────────────────────────────────────────
    if (action === 'owner_get_team') {
      const { exhibitor_id } = requestData
      if (!exhibitor_id) return jsonError('exhibitor_id required', 400)

      // Verify caller is an active team member
      if (!isAdmin) {
        const { data: callerMembership } = await serviceClient
          .from('exhibitor_team_members')
          .select('id')
          .eq('exhibitor_id', exhibitor_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (!callerMembership) {
          return jsonError('Not authorized', 403)
        }
      }

      const { data: members, error } = await serviceClient
        .from('exhibitor_team_members')
        .select('id, user_id, role, status, created_at')
        .eq('exhibitor_id', exhibitor_id)
        .eq('status', 'active')
        .order('created_at')

      if (error) return jsonError('Failed to fetch team', 500)

      // Enrich with profile data
      const enriched = await Promise.all((members || []).map(async (m: any) => {
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('first_name, last_name, avatar_url, job_title, company')
          .eq('user_id', m.user_id)
          .maybeSingle()

        // Get email from auth
        const { data: authData } = await serviceClient.auth.admin.getUserById(m.user_id)

        return {
          ...m,
          email: authData?.user?.email || null,
          profile: profile || null,
        }
      }))

      return jsonOk(enriched)
    }

    // ────────────────────────────────────────────────────
    // ACTION: claim (any authenticated user)
    // ────────────────────────────────────────────────────
    if (action === 'claim') {
      const { exhibitor_id } = requestData

      if (!exhibitor_id) {
        return jsonError('exhibitor_id is required', 400)
      }

      // Check if exhibitor exists and has no owner
      const { data: exhibitor } = await serviceClient
        .from('exhibitors')
        .select('id, name, owner_user_id')
        .eq('id', exhibitor_id)
        .single()

      if (!exhibitor) {
        return jsonError('Exhibitor not found', 404)
      }

      if (exhibitor.owner_user_id) {
        return jsonError('Exhibitor already has an owner', 400)
      }

      // Create claim request
      const { data: claimRequest, error: claimError } = await serviceClient
        .from('exhibitor_claim_requests')
        .insert({
          exhibitor_id,
          requester_user_id: user.id
        })
        .select()
        .single()

      if (claimError) {
        if (claimError.code === '23505') {
          return jsonError('Claim request already exists', 400)
        }
        console.error('Error creating claim request:', claimError)
        return jsonError('Failed to create claim request', 500)
      }

      // Send admin notification email
      try {
        const { data: requesterProfile } = await serviceClient
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .single()

        const requesterName = [requesterProfile?.first_name, requesterProfile?.last_name].filter(Boolean).join(' ') || 'Utilisateur inconnu'
        const adminUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/admin/exhibitors`

        await serviceClient.from('notifications').insert({
          user_id: user.id,
          type: 'claim_request',
          category: 'admin',
          title: 'Nouvelle demande de gestion',
          message: `${requesterName} demande la gestion de "${exhibitor.name}"`,
          link_url: '/admin/exhibitors',
          exhibitor_id: exhibitor_id,
          actor_user_id: user.id,
          actor_name: requesterName,
          actor_email: user.email,
        })

        // Send email to admin@lotexpo.com
        const emailBody = `
          <h2>Nouvelle demande de gestion d'entreprise</h2>
          <table style="border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:4px 12px 4px 0;color:#666">Entreprise</td><td style="padding:4px 0;font-weight:bold">${exhibitor.name}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666">Demandeur</td><td style="padding:4px 0">${requesterName}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="padding:4px 0">${user.email}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td style="padding:4px 0">${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
          </table>
          <p><a href="https://lotexpo.com/admin/exhibitors" style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;border-radius:6px;text-decoration:none">Traiter la demande</a></p>
        `
        // Use Supabase Edge Function for email if available, otherwise log
        console.log('📧 Admin notification email queued for admin@lotexpo.com:', {
          subject: `[Lotexpo] Demande de gestion : ${exhibitor.name}`,
          exhibitor: exhibitor.name,
          requester: requesterName,
          email: user.email,
        })

        // Try to send via contact-submit pattern (reuse existing function)
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/contact-submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            name: 'Système Lotexpo',
            email: 'noreply@lotexpo.com',
            subject: `[Lotexpo] Demande de gestion : ${exhibitor.name}`,
            message: `Nouvelle demande de gestion par ${requesterName} (${user.email}) pour l'entreprise "${exhibitor.name}". Traiter sur https://lotexpo.com/admin/exhibitors`,
            to: 'admin@lotexpo.com',
          }),
        })
      } catch (emailError) {
        console.error('⚠️ Failed to send admin notification:', emailError)
        // Non-blocking - claim was still created
      }

      return jsonOk(claimRequest)
    }

    // ────────────────────────────────────────────────────
    // ACTION: create-request (any authenticated user)
    // ────────────────────────────────────────────────────
    if (action === 'create-request') {
      const { proposed_name, website } = requestData

      if (!proposed_name) {
        return jsonError('proposed_name is required', 400)
      }

      const { data: createRequest, error: createError } = await serviceClient
        .from('exhibitor_create_requests')
        .insert({
          proposed_name,
          website,
          requester_user_id: user.id
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating exhibitor request:', createError)
        return jsonError('Failed to create exhibitor request', 500)
      }

      return jsonOk(createRequest)
    }

    // ────────────────────────────────────────────────────
    // ACTION: admin_add_member (admin only)
    // ────────────────────────────────────────────────────
    if (action === 'admin_add_member') {
      const log = (step: string, data?: Record<string, unknown>) =>
        console.log(`[exhibitors-manage][${requestId}] step=${step}`, data ?? '')

      log('admin_add_member.start')
      if (!isAdmin) return jsonError('Admin access required', 403)

      const { exhibitor_id, user_email, role } = requestData
      if (!exhibitor_id || !user_email) return jsonError('exhibitor_id and user_email required', 400)
      log('admin_add_member.inputs_valid', { exhibitor_id, user_email, role })

      // ── Step 1: Get exhibitor name ──
      let exhibitorName = 'une entreprise'
      try {
        log('admin_add_member.fetch_exhibitor.begin')
        const { data: exhibitorData, error: exErr } = await serviceClient
          .from('exhibitors')
          .select('name')
          .eq('id', exhibitor_id)
          .maybeSingle()
        if (exErr) {
          log('admin_add_member.fetch_exhibitor.error', { message: exErr.message, code: exErr.code })
        } else {
          exhibitorName = exhibitorData?.name || exhibitorName
        }
        log('admin_add_member.fetch_exhibitor.done', { exhibitorName })
      } catch (err: any) {
        console.error(`[exhibitors-manage][${requestId}] step=admin_add_member.fetch_exhibitor.exception`, {
          name: err?.name, message: err?.message, stack: err?.stack,
        })
        // non-blocking — continue with default name
      }

      // ── Step 2: Resolve user by email ──
      let targetUserId: string | null = null
      try {
        log('admin_add_member.resolve_user.begin', { user_email })
        const { data: rpcData, error: rpcError } = await serviceClient.rpc('get_user_id_by_email', { p_email: user_email })
        if (rpcError) {
          log('admin_add_member.resolve_user.rpc_error', { message: rpcError.message, code: rpcError.code })
          return jsonError('User lookup failed', 500)
        }
        targetUserId = rpcData ?? null
        log('admin_add_member.resolve_user.done', { foundUser: !!targetUserId, targetUserId })
      } catch (err: any) {
        console.error(`[exhibitors-manage][${requestId}] step=admin_add_member.resolve_user.exception`, {
          name: err?.name, message: err?.message, stack: err?.stack,
        })
        return new Response(
          JSON.stringify({ ok: false, stage: 'admin_add_member.resolve_user', requestId, error: err?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!targetUserId) {
        // ── User doesn't exist → create invitation ──
        try {
          log('admin_add_member.invite_flow.begin')
          const { data: existingInvite, error: eiErr } = await serviceClient
            .from('exhibitor_invitations')
            .select('id')
            .eq('email', user_email.toLowerCase())
            .eq('exhibitor_id', exhibitor_id)
            .eq('status', 'pending')
            .maybeSingle()

          if (eiErr) log('admin_add_member.invite_flow.existing_check_error', { message: eiErr.message })
          if (existingInvite) return jsonError('Une invitation est déjà en attente pour cet email', 400)

          const { data: invitation, error: invErr } = await serviceClient
            .from('exhibitor_invitations')
            .insert({
              email: user_email.toLowerCase(),
              exhibitor_id,
              invited_by: user.id,
              role: role || 'admin',
            })
            .select('id, token')
            .single()

          if (invErr || !invitation) {
            log('admin_add_member.invite_flow.insert_error', { message: invErr?.message, code: invErr?.code })
            return jsonError('Failed to create invitation', 500)
          }

          log('admin_add_member.invite_flow.inserted', { invitationId: invitation.id })

          const siteUrl = Deno.env.get('SITE_URL') || 'https://lotexpo.com'
          const signupUrl = `${siteUrl}/auth?invite=${invitation.token}&email=${encodeURIComponent(user_email)}`

          let emailResult = { success: false, error: 'not_attempted' } as any
          try {
            log('admin_add_member.invite_flow.send_email.begin', { to: user_email })
            emailResult = await sendExhibitorEmail({
              to: user_email,
              subject: `Invitation à gérer ${exhibitorName} sur Lotexpo`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #1a1a1a; font-size: 24px; text-align: center;">📩 Vous êtes invité(e) !</h1>
                  <p style="color: #333; font-size: 16px; line-height: 1.6;">
                    Vous avez été invité à devenir gestionnaire de <strong>${exhibitorName}</strong> sur <strong>Lotexpo</strong>.
                  </p>
                  <p style="color: #333; font-size: 16px; line-height: 1.6;">Créez votre compte pour accepter l'invitation :</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${signupUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">Créer mon compte</a>
                  </div>
                  <p style="color: #888; font-size: 13px;">Cette invitation expire dans 30 jours. — L'équipe Lotexpo</p>
                </div>
              `,
            })
            log('admin_add_member.invite_flow.send_email.done', { success: emailResult.success, status: emailResult.status })
          } catch (emailErr: any) {
            console.error(`[exhibitors-manage][${requestId}] step=admin_add_member.invite_flow.send_email.exception`, {
              name: emailErr?.name, message: emailErr?.message, stack: emailErr?.stack,
            })
            emailResult = { success: false, error: emailErr?.message }
          }

          log('admin_add_member.invite_flow.return_success')
          return jsonOk({
            status: 'invited',
            email: user_email,
            email_sent: emailResult.success,
            ...(emailResult.error ? { email_warning: emailResult.error } : {}),
          })
        } catch (err: any) {
          console.error(`[exhibitors-manage][${requestId}] step=admin_add_member.invite_flow.exception`, {
            name: err?.name, message: err?.message, stack: err?.stack,
          })
          return new Response(
            JSON.stringify({ ok: false, stage: 'admin_add_member.invite_flow', requestId, error: err?.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // ── User exists → add directly ──
      try {
        log('admin_add_member.direct_add.begin', { targetUserId })

        // Check existing membership
        log('admin_add_member.direct_add.check_existing.begin')
        const { data: existing, error: existErr } = await serviceClient
          .from('exhibitor_team_members')
          .select('id')
          .eq('exhibitor_id', exhibitor_id)
          .eq('user_id', targetUserId)
          .eq('status', 'active')
          .maybeSingle()

        if (existErr) {
          log('admin_add_member.direct_add.check_existing.error', { message: existErr.message, code: existErr.code })
        }
        log('admin_add_member.direct_add.check_existing.done', { alreadyMember: !!existing })

        if (existing) return jsonError('Cet utilisateur est déjà membre', 400)

        // Upsert team member
        log('admin_add_member.direct_add.upsert.begin', { exhibitor_id, targetUserId, role: role || 'admin' })
        const { error: insertErr } = await serviceClient
          .from('exhibitor_team_members')
          .insert({
            exhibitor_id,
            user_id: targetUserId,
            role: role || 'admin',
            status: 'active',
            invited_by: user.id,
          })

        if (insertErr) {
          log('admin_add_member.direct_add.upsert.error', { message: insertErr.message, code: insertErr.code, details: insertErr.details })
          return jsonError('Failed to add member', 500)
        }
        log('admin_add_member.direct_add.upsert.done')

        // Send email (non-blocking for business logic)
        const siteUrl = Deno.env.get('SITE_URL') || 'https://lotexpo.com'
        let emailResult = { success: false, error: 'not_attempted' } as any
        try {
          log('admin_add_member.direct_add.send_email.begin', { to: user_email, exhibitorName })
          emailResult = await sendExhibitorEmail({
            to: user_email,
            subject: `Vous avez été ajouté comme gestionnaire de ${exhibitorName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #1a1a1a; font-size: 24px; text-align: center;">🎉 Bienvenue dans l'équipe !</h1>
                <p style="color: #333; font-size: 16px; line-height: 1.6;">
                  Vous avez été ajouté comme gestionnaire de <strong>${exhibitorName}</strong> sur Lotexpo.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${siteUrl}/profile" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">Accéder à mon espace</a>
                </div>
                <p style="color: #888; font-size: 13px;">— L'équipe Lotexpo</p>
              </div>
            `,
          })
          log('admin_add_member.direct_add.send_email.done', { success: emailResult.success, status: emailResult.status, error: emailResult.error })
        } catch (emailErr: any) {
          console.error(`[exhibitors-manage][${requestId}] step=admin_add_member.direct_add.send_email.exception`, {
            name: emailErr?.name, message: emailErr?.message, stack: emailErr?.stack,
          })
          emailResult = { success: false, error: emailErr?.message }
        }

        log('admin_add_member.direct_add.return_success')
        return jsonOk({
          status: 'added',
          user_id: targetUserId,
          email_sent: emailResult.success,
          ...(emailResult.error ? { email_warning: emailResult.error } : {}),
        })
      } catch (err: any) {
        console.error(`[exhibitors-manage][${requestId}] step=admin_add_member.direct_add.exception`, {
          name: err?.name, message: err?.message, stack: err?.stack,
          exhibitor_id, user_email, targetUserId,
        })
        return new Response(
          JSON.stringify({ ok: false, stage: 'admin_add_member.direct_add', requestId, error: err?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ────────────────────────────────────────────────────
    // ACTION: admin_remove_member (admin only)
    // ────────────────────────────────────────────────────
    if (action === 'admin_remove_member') {
      if (!isAdmin) return jsonError('Admin access required', 403)

      const { membership_id } = requestData
      if (!membership_id) return jsonError('membership_id required', 400)

      const { error } = await serviceClient
        .from('exhibitor_team_members')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', membership_id)

      if (error) return jsonError('Failed to remove member', 500)
      return jsonOk({ status: 'removed' })
    }

    // ────────────────────────────────────────────────────
    // ACTION: admin_promote_owner (admin only)
    // ────────────────────────────────────────────────────
    if (action === 'admin_promote_owner') {
      if (!isAdmin) return jsonError('Admin access required', 403)

      const { membership_id, exhibitor_id } = requestData
      if (!membership_id || !exhibitor_id) return jsonError('membership_id and exhibitor_id required', 400)

      // Get the member to promote
      const { data: member } = await serviceClient
        .from('exhibitor_team_members')
        .select('user_id')
        .eq('id', membership_id)
        .single()

      if (!member) return jsonError('Member not found', 404)

      // Demote current owner(s) to admin
      await serviceClient
        .from('exhibitor_team_members')
        .update({ role: 'admin' })
        .eq('exhibitor_id', exhibitor_id)
        .eq('role', 'owner')
        .eq('status', 'active')

      // Promote new owner
      const { error } = await serviceClient
        .from('exhibitor_team_members')
        .update({ role: 'owner' })
        .eq('id', membership_id)

      if (error) return jsonError('Failed to promote owner', 500)

      // Update exhibitors.owner_user_id
      await serviceClient
        .from('exhibitors')
        .update({ owner_user_id: member.user_id })
        .eq('id', exhibitor_id)

      return jsonOk({ status: 'promoted', new_owner: member.user_id })
    }

    // ────────────────────────────────────────────────────
    // ACTION: admin_revoke_governance (admin only)
    // ────────────────────────────────────────────────────
    if (action === 'admin_revoke_governance') {
      if (!isAdmin) return jsonError('Admin access required', 403)

      const { exhibitor_id } = requestData
      if (!exhibitor_id) return jsonError('exhibitor_id required', 400)

      // Remove all active team members
      await serviceClient
        .from('exhibitor_team_members')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('exhibitor_id', exhibitor_id)
        .eq('status', 'active')

      // Clear owner
      await serviceClient
        .from('exhibitors')
        .update({ owner_user_id: null, verified_at: null })
        .eq('id', exhibitor_id)

      return jsonOk({ status: 'revoked' })
    }

    return jsonError('Unknown action: ' + action, 400)

  } catch (error) {
    const errObj = error instanceof Error ? error : new Error(String(error))
    console.error(`[exhibitors-manage][${requestId}] UNHANDLED`, {
      name: errObj.name,
      message: errObj.message,
      stack: errObj.stack,
      cause: (errObj as any).cause,
    })
    return new Response(
      JSON.stringify({ ok: false, stage: 'unhandled_handler_error', requestId, error: errObj.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Helper functions ──

async function sendExhibitorEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; status?: number; error?: string }> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Lotexpo <admin@lotexpo.com>'

  console.log('📧 Sending email', {
    to: params.to,
    subject: params.subject,
    from: resendFromEmail,
    hasApiKey: !!RESEND_API_KEY,
    apiKeyPrefix: RESEND_API_KEY?.substring(0, 8) ?? 'MISSING',
  })

  if (!RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not set')
    return { success: false, error: 'RESEND_API_KEY missing' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    })

    const body = await res.text()

    if (!res.ok) {
      console.error(`❌ Email send failed [${res.status}]:`, body)
      return { success: false, status: res.status, error: body }
    }

    console.log(`📧 Email sent successfully to ${params.to} [${res.status}]`)
    return { success: true, status: res.status }
  } catch (err) {
    console.error('❌ Email send exception:', err)
    return { success: false, error: String(err) }
  }
}

function jsonOk(data: unknown) {
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function jsonError(message: string, status: number, details?: unknown) {
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
