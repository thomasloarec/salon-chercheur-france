import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Auth client: used ONLY to verify the caller's identity ──
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
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

    // ── Service client: used for all DB writes (bypasses RLS) ──
    // All authorization checks are done explicitly in code below.
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    )

    // Check admin status once (reused across actions)
    const { data: isAdmin } = await authClient.rpc('is_admin')

    const requestData = await req.json()
    const { action } = requestData

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

      // STEP 1: Create modern exhibitor
      const { data: newExhibitor, error: createError } = await serviceClient
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

      if (createError || !newExhibitor) {
        console.error('❌ Failed to create exhibitor:', createError)
        return jsonError('Failed to create exhibitor', 500, createError)
      }

      console.log('✅ Exhibitor created:', newExhibitor.id)

      // STEP 2: Create legacy entry in exposants
      const { error: legacyError } = await serviceClient
        .from('exposants')
        .insert({
          id_exposant: newExhibitor.id,
          nom_exposant: name,
          website_exposant: website || null,
          exposant_description: description || null
        })

      if (legacyError) {
        console.error('⚠️ Failed to create legacy exposant:', legacyError)
      } else {
        console.log('✅ Legacy exposant created with id:', newExhibitor.id)
      }

      // STEP 3: Create participation (unless deferred)
      if (!defer_participation) {
        const { data: eventData } = await serviceClient
          .from('events')
          .select('id_event')
          .eq('id', event_id)
          .single()

        const { error: participationError } = await serviceClient
          .from('participation')
          .insert({
            id_exposant: newExhibitor.id,
            exhibitor_id: newExhibitor.id,
            id_event: event_id,
            id_event_text: eventData?.id_event || null,
            website_exposant: website || null,
            stand_exposant: stand_info || null,
            urlexpo_event: null
          })

        if (participationError) {
          console.error('❌ Failed to create participation:', participationError)
          return jsonError('Exhibitor created but participation failed', 500, participationError)
        }

        console.log('✅ Participation created for event:', event_id)
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

    // ────────────────────────────────────────────────────
    // ACTION: owner_add_member (owner of the exhibitor)
    // ────────────────────────────────────────────────────
    if (action === 'owner_add_member') {
      const { exhibitor_id, user_email } = requestData
      if (!exhibitor_id || !user_email) return jsonError('exhibitor_id and user_email required', 400)

      // Verify caller is owner of this exhibitor
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
          return jsonError('Seul le propriétaire peut ajouter des collaborateurs', 403)
        }
      }

      // Get exhibitor name for email
      const { data: exhibitorData } = await serviceClient
        .from('exhibitors')
        .select('name')
        .eq('id', exhibitor_id)
        .single()
      const exhibitorName = exhibitorData?.name || 'une entreprise'

      // Get inviter name
      const { data: inviterProfile } = await serviceClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single()
      const inviterName = inviterProfile
        ? `${inviterProfile.first_name || ''} ${inviterProfile.last_name || ''}`.trim() || 'Un gestionnaire'
        : 'Un gestionnaire'

      // Find user by email
      let targetUserId: string | null = null
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
      const matchedUser = authUsers?.users?.find((u: any) => u.email?.toLowerCase() === user_email.toLowerCase())
      if (matchedUser) targetUserId = matchedUser.id

      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
      const RESEND_GATEWAY = 'https://connector-gateway.lovable.dev/resend'
      const siteUrl = Deno.env.get('SITE_URL') || 'https://lotexpo.lovable.app'

      if (targetUserId) {
        // ── Existing user: add to team directly ──
        const { data: existing } = await serviceClient
          .from('exhibitor_team_members')
          .select('id')
          .eq('exhibitor_id', exhibitor_id)
          .eq('user_id', targetUserId)
          .eq('status', 'active')
          .maybeSingle()

        if (existing) return jsonError('Cet utilisateur est déjà membre', 400)

        const { error } = await serviceClient
          .from('exhibitor_team_members')
          .insert({
            exhibitor_id,
            user_id: targetUserId,
            role: 'admin',
            status: 'active',
            invited_by: user.id,
          })

        if (error) return jsonError('Failed to add member', 500)

        // Send notification email to existing user
        if (RESEND_API_KEY) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Lotexpo <admin@lotexpo.com>',
                to: [user_email],
                subject: `Vous êtes maintenant gestionnaire de ${exhibitorName} sur Lotexpo`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #1a1a1a; font-size: 24px;">🎉 Bienvenue dans l'équipe !</h1>
                    </div>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                      Bonjour,
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                      <strong>${inviterName}</strong> vous a ajouté comme collaborateur de la page entreprise 
                      <strong>${exhibitorName}</strong> sur Lotexpo.
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                      En tant que collaborateur, vous pouvez :
                    </p>
                    <ul style="color: #333; font-size: 16px; line-height: 1.8;">
                      <li>✏️ Modifier la description de l'entreprise</li>
                      <li>🆕 Ajouter et gérer les nouveautés produits</li>
                    </ul>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${siteUrl}/profil" 
                         style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                        Accéder à mon espace
                      </a>
                    </div>
                    <p style="color: #888; font-size: 13px; margin-top: 30px;">
                      — L'équipe Lotexpo
                    </p>
                  </div>
                `,
              }),
            })
          } catch (emailErr) {
            console.error('Failed to send notification email:', emailErr)
          }
        }

        return jsonOk({ status: 'added', user_id: targetUserId })

      } else {
        // ── Non-existing user: create invitation ──
        // Check for existing pending invitation
        const { data: existingInvite } = await serviceClient
          .from('exhibitor_invitations')
          .select('id')
          .eq('email', user_email.toLowerCase())
          .eq('exhibitor_id', exhibitor_id)
          .eq('status', 'pending')
          .maybeSingle()

        if (existingInvite) return jsonError('Une invitation est déjà en attente pour cet email', 400)

        const { data: invitation, error: invErr } = await serviceClient
          .from('exhibitor_invitations')
          .insert({
            email: user_email.toLowerCase(),
            exhibitor_id,
            invited_by: user.id,
            role: 'admin',
          })
          .select('id, token')
          .single()

        if (invErr || !invitation) return jsonError('Failed to create invitation', 500)

        // Send invitation email to non-existing user
        if (RESEND_API_KEY) {
          try {
            const signupUrl = `${siteUrl}/auth?invite=${invitation.token}&email=${encodeURIComponent(user_email)}`
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Lotexpo <admin@lotexpo.com>',
                to: [user_email],
                subject: `${inviterName} vous invite à gérer ${exhibitorName} sur Lotexpo`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #1a1a1a; font-size: 24px;">📩 Vous êtes invité(e) !</h1>
                    </div>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                      Bonjour,
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                      <strong>${inviterName}</strong> vous invite à rejoindre l'équipe de gestion de 
                      <strong>${exhibitorName}</strong> sur <strong>Lotexpo</strong>, la plateforme de référence 
                      des salons professionnels en France.
                    </p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">
                      En créant votre compte, vous pourrez :
                    </p>
                    <ul style="color: #333; font-size: 16px; line-height: 1.8;">
                      <li>✏️ Gérer la page de votre entreprise</li>
                      <li>🆕 Publier des nouveautés produits</li>
                      <li>📊 Suivre les leads et interactions</li>
                    </ul>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${signupUrl}" 
                         style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                        Créer mon compte et rejoindre l'équipe
                      </a>
                    </div>
                    <p style="color: #888; font-size: 13px; margin-top: 30px;">
                      Cette invitation expire dans 30 jours.<br/>
                      — L'équipe Lotexpo
                    </p>
                  </div>
                `,
              }),
            })
          } catch (emailErr) {
            console.error('Failed to send invitation email:', emailErr)
          }
        }

        return jsonOk({ status: 'invited', email: user_email })
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
          <p><a href="https://lotexpo.lovable.app/admin/exhibitors" style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;border-radius:6px;text-decoration:none">Traiter la demande</a></p>
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
            message: `Nouvelle demande de gestion par ${requesterName} (${user.email}) pour l'entreprise "${exhibitor.name}". Traiter sur https://lotexpo.lovable.app/admin/exhibitors`,
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
      if (!isAdmin) return jsonError('Admin access required', 403)

      const { exhibitor_id, user_email, role } = requestData
      if (!exhibitor_id || !user_email) return jsonError('exhibitor_id and user_email required', 400)

      // Resolve user by email
      const { data: users } = await serviceClient.rpc('get_user_emails_for_moderation', {
        user_ids: [],
      })

      // Alternative: find user by email in profiles or auth
      const { data: profileMatch } = await serviceClient
        .from('profiles')
        .select('user_id')
        .limit(100)

      // Use auth admin to find user
      let targetUserId: string | null = null
      // Search in auth.users via service client
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
      const matchedUser = authUsers?.users?.find((u: any) => u.email?.toLowerCase() === user_email.toLowerCase())
      if (matchedUser) targetUserId = matchedUser.id

      if (!targetUserId) return jsonError('Utilisateur non trouvé avec cet email', 404)

      // Check for existing membership
      const { data: existing } = await serviceClient
        .from('exhibitor_team_members')
        .select('id')
        .eq('exhibitor_id', exhibitor_id)
        .eq('user_id', targetUserId)
        .eq('status', 'active')
        .maybeSingle()

      if (existing) return jsonError('Cet utilisateur est déjà membre', 400)

      const { error } = await serviceClient
        .from('exhibitor_team_members')
        .insert({
          exhibitor_id,
          user_id: targetUserId,
          role: role || 'admin',
          status: 'active',
          invited_by: user.id,
        })

      if (error) return jsonError('Failed to add member', 500)
      return jsonOk({ status: 'added', user_id: targetUserId })
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
    console.error('Exhibitor management error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Helper functions ──

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
