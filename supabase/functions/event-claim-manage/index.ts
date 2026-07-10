import { createClient } from 'npm:@supabase/supabase-js@2'

// ============================================================================
// event-claim-manage
// Revendication d'une page salon par son organisateur.
// Calqué sur exhibitor-claim-bridge (auth, vérif admin, notifs Resend + in-app).
//
// Actions (dans le body JSON) :
//   - action: 'create'   (utilisateur authentifié) -> crée/rafraîchit une demande
//                         de revendication + alerte admin (email + in-app).
//   - action: 'approve'  (admin) -> RPC admin_approve_event_claim + notif demandeur.
//   - action: 'reject'   (admin) -> RPC admin_reject_event_claim  + notif demandeur.
//
// Sécurité : l'organisateur n'écrit JAMAIS dans events. L'attribution de la
// propriété passe uniquement par les RPC service_role (admin_*_event_claim).
// Déployer avec verify_jwt = false (auth gérée manuellement ci-dessous).
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Destinataire des alertes admin (Resend via send.lotexpo.com)
const ADMIN_NOTIFICATION_EMAIL = 'admin@lotexpo.com'
// Route admin qui listera les demandes de revendication salon (construite en Phase 3)
const ADMIN_CLAIMS_URL = 'https://lotexpo.com/admin/organisateurs'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function isPlatformAdmin(admin: any, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  return !!data
}

async function resolveRequesterName(admin: any, userId: string, fallbackEmail?: string | null): Promise<string> {
  try {
    const { data: prof } = await admin
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()
    const full = [prof?.first_name, prof?.last_name].filter(Boolean).join(' ').trim()
    if (full) return full
  } catch (_) { /* non-bloquant */ }
  return fallbackEmail ?? 'Demandeur inconnu'
}

// Alerte email admin (Resend). Ne lève JAMAIS : tout échec est loggé puis avalé.
async function sendAdminClaimAlertEmail(params: { eventName: string; requesterName: string }): Promise<void> {
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) { console.error('[event-claim] RESEND_API_KEY manquant — email admin ignoré'); return }
    const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Lotexpo <admin@lotexpo.com>'
    const safeEvent = escapeHtml(params.eventName)
    const safeRequester = escapeHtml(params.requesterName)
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <h2 style="font-size: 18px; margin: 0 0 16px;">Nouvelle revendication de salon à valider</h2>
        <p style="font-size: 14px; line-height: 1.5; margin: 0 0 20px;">
          ${safeRequester} demande à revendiquer la page du salon <strong>${safeEvent}</strong>.
          Vérifiez la demande puis validez ou refusez.
        </p>
        <p style="margin: 0 0 24px;">
          <a href="${ADMIN_CLAIMS_URL}" style="display: inline-block; background: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 14px;">
            Examiner la demande
          </a>
        </p>
      </div>
    `
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [ADMIN_NOTIFICATION_EMAIL],
        subject: `Nouvelle revendication salon — ${params.eventName}`,
        html,
      }),
    })
    if (!res.ok) {
      const b = await res.text().catch(() => '')
      console.error(`[event-claim] email admin échoué [${res.status}]:`, b.slice(0, 500))
      return
    }
    console.log(`[event-claim] email admin envoyé pour "${params.eventName}"`)
  } catch (err) {
    console.error('[event-claim] exception email admin:', err)
  }
}

// Notif in-app à tous les admins. Ne lève JAMAIS.
async function notifyAdminsInApp(admin: any, params: { eventName: string; requesterName: string }): Promise<void> {
  try {
    const { data: admins, error } = await admin.from('user_roles').select('user_id').eq('role', 'admin')
    if (error) throw error
    const ids = (admins ?? []).map((a: any) => a.user_id).filter(Boolean)
    if (ids.length === 0) { console.warn('[event-claim] aucun admin pour la notif in-app'); return }
    const rows = ids.map((adminId: string) => ({
      user_id: adminId,
      type: 'event_claim_request',
      category: 'event_mgmt',
      title: 'Nouvelle revendication de salon',
      message: `${params.requesterName} demande à revendiquer la page du salon ${params.eventName}.`,
      icon: '📥',
      link_url: '/admin/organisateurs',
      read: false,
    }))
    const { error: insErr } = await admin.from('notifications').insert(rows)
    if (insErr) throw insErr
    console.log(`[event-claim] notif in-app insérée pour ${ids.length} admin(s)`)
  } catch (err) {
    console.error('[event-claim] notif in-app admin échouée (non-bloquant):', err)
  }
}

// Notif au demandeur après décision. Ne lève JAMAIS.
async function notifyRequester(admin: any, params: { userId: string; eventName: string; approved: boolean }): Promise<void> {
  try {
    const row = {
      user_id: params.userId,
      type: params.approved ? 'event_claim_approved' : 'event_claim_rejected',
      category: 'event_mgmt',
      title: params.approved ? 'Revendication acceptée' : 'Revendication refusée',
      message: params.approved
        ? `Vous gérez désormais la page du salon ${params.eventName}. Vous pouvez proposer des modifications.`
        : `Votre demande de revendication pour ${params.eventName} n'a pas été retenue.`,
      icon: params.approved ? '✅' : '❌',
      link_url: null,
      read: false,
    }
    const { error } = await admin.from('notifications').insert(row)
    if (error) throw error
  } catch (err) {
    console.error('[event-claim] notif demandeur échouée (non-bloquant):', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'AUTH_REQUIRED', message: 'Authentification requise.' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'AUTH_REQUIRED', message: 'Utilisateur non authentifié.' }, 401)

    // --- Client service_role pour les mutations ---
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? '')

    // ========================================================================
    // CREATE — organisateur crée / rafraîchit une demande de revendication
    // ========================================================================
    if (action === 'create') {
      const eventId = String(body?.event_id ?? '').trim()
      const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : null
      if (!eventId) return json({ error: 'INVALID_INPUT', message: "L'identifiant du salon est requis." }, 400)

      const { data: ev } = await admin
        .from('events')
        .select('id, nom_event, visible, is_test, owner_user_id')
        .eq('id', eventId)
        .maybeSingle()
      if (!ev) return json({ error: 'EVENT_NOT_FOUND', message: 'Salon introuvable.' }, 404)
      if (ev.is_test || !ev.visible)
        return json({ error: 'EVENT_NOT_CLAIMABLE', message: "Ce salon n'est pas revendiquable." }, 400)

      // Déjà propriétaire (le même user) -> court-circuit
      if (ev.owner_user_id && ev.owner_user_id === user.id)
        return json({ success: true, already_owner: true, event_id: ev.id, message: 'Vous gérez déjà ce salon.' })

      // Demande existante ?
      const { data: existing } = await admin
        .from('event_claim_requests')
        .select('id, status')
        .eq('event_id', ev.id)
        .eq('requester_user_id', user.id)
        .maybeSingle()
      if (existing?.status === 'approved')
        return json({ success: true, already_approved: true, event_id: ev.id, claim_id: existing.id, message: 'Votre revendication est déjà validée.' })
      const wasPending = existing?.status === 'pending'

      // Upsert : une demande rejected/pending est ré-ouverte en pending
      const { data: claim, error: claimErr } = await admin
        .from('event_claim_requests')
        .upsert(
          { event_id: ev.id, requester_user_id: user.id, status: 'pending', message, created_at: new Date().toISOString() },
          { onConflict: 'event_id,requester_user_id' }
        )
        .select('id')
        .single()
      if (claimErr) {
        console.error('[event-claim] upsert claim erreur:', claimErr)
        return json({ error: 'CLAIM_FAILED', message: 'Erreur lors de la création de la demande.' }, 500)
      }

      const requesterName = await resolveRequesterName(admin, user.id, user.email)
      await sendAdminClaimAlertEmail({ eventName: ev.nom_event, requesterName })
      await notifyAdminsInApp(admin, { eventName: ev.nom_event, requesterName })

      return json({
        success: true,
        event_id: ev.id,
        claim_id: claim.id,
        already_pending: wasPending,
        message: wasPending
          ? 'Vous aviez déjà une demande en cours ; elle a été actualisée.'
          : 'Votre demande a bien été envoyée.',
      })
    }

    // ========================================================================
    // APPROVE / REJECT — admin uniquement
    // ========================================================================
    if (action === 'approve' || action === 'reject') {
      if (!(await isPlatformAdmin(admin, user.id)))
        return json({ error: 'FORBIDDEN', message: 'Action réservée aux administrateurs.' }, 403)

      const requestId = String(body?.request_id ?? '').trim()
      if (!requestId) return json({ error: 'INVALID_INPUT', message: 'request_id requis.' }, 400)

      const { data: claim } = await admin
        .from('event_claim_requests')
        .select('id, requester_user_id, event_id, status')
        .eq('id', requestId)
        .maybeSingle()
      if (!claim) return json({ error: 'CLAIM_NOT_FOUND', message: 'Demande introuvable.' }, 404)

      const { data: ev } = await admin.from('events').select('nom_event').eq('id', claim.event_id).maybeSingle()
      const eventName = ev?.nom_event ?? 'ce salon'

      if (action === 'approve') {
        const { error: rpcErr } = await admin.rpc('admin_approve_event_claim', {
          p_request_id: requestId,
          p_admin_user_id: user.id,
        })
        if (rpcErr) {
          console.error('[event-claim] approve rpc erreur:', rpcErr)
          return json({ error: 'APPROVE_FAILED', message: rpcErr.message }, 400)
        }
        await notifyRequester(admin, { userId: claim.requester_user_id, eventName, approved: true })
        return json({ success: true, event_id: claim.event_id, status: 'approved' })
      } else {
        const { error: rpcErr } = await admin.rpc('admin_reject_event_claim', {
          p_request_id: requestId,
          p_admin_user_id: user.id,
        })
        if (rpcErr) {
          console.error('[event-claim] reject rpc erreur:', rpcErr)
          return json({ error: 'REJECT_FAILED', message: rpcErr.message }, 400)
        }
        await notifyRequester(admin, { userId: claim.requester_user_id, eventName, approved: false })
        return json({ success: true, event_id: claim.event_id, status: 'rejected' })
      }
    }

    return json({ error: 'UNKNOWN_ACTION', message: "Action inconnue. Utilisez 'create', 'approve' ou 'reject'." }, 400)
  } catch (err) {
    console.error('[event-claim] erreur inattendue:', err)
    return json({ error: 'INTERNAL_ERROR', message: 'Une erreur inattendue est survenue.' }, 500)
  }
})