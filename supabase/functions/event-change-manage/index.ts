import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from '../_shared/resend.ts'
import { renderEmailShell, heading, paragraph } from '../_shared/email-template.ts'

// ============================================================================
// event-change-manage
// Demandes de modification d'une fiche salon par son organisateur (Phase 3).
//
// Actions (body JSON) :
//   - action: 'submit'  (organisateur propriétaire) -> insère une demande de
//              modification (event_change_requests, status=pending) + alerte admin.
//   - action: 'approve' (admin) -> RPC admin_apply_event_change (écrit dans events
//              en franchissant le garde-fou anti-import) + notif organisateur.
//   - action: 'reject'  (admin) -> RPC admin_reject_event_change + notif organisateur.
//
// Sécurité : l'organisateur n'écrit JAMAIS dans events. La soumission crée
// seulement une demande en attente ; seule l'approbation admin applique les
// valeurs, via une RPC service_role qui pose le signal transactionnel autorisant
// l'écriture des colonnes gelées.
// Déployer avec verify_jwt = false (auth gérée manuellement ci-dessous).
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_NOTIFICATION_EMAIL = 'admin@lotexpo.com'
const ADMIN_URL = 'https://lotexpo.com/admin/organisateurs'

// Seuls ces champs sont éditables par l'organisateur (miroir du garde-fou en base)
const EDITABLE_FIELDS = [
  'nom_event',
  'date_debut',
  'date_fin',
  'secteur',
  'affluence',
  'tarif',
  'url_image',
  'description_event',
] as const

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
  return fallbackEmail ?? 'Organisateur inconnu'
}

// Alerte email admin (Resend). Ne lève JAMAIS.
async function sendAdminChangeAlertEmail(params: { eventName: string; requesterName: string; fieldsCount: number }): Promise<void> {
  try {
    const safeEvent = escapeHtml(params.eventName)
    const safeRequester = escapeHtml(params.requesterName)
    const subject = `Modifications à valider — ${params.eventName}`
    const html = renderEmailShell({
      title: subject,
      preheader: `${params.requesterName} a proposé des modifications pour un salon.`,
      bodyBlocks: [
        heading(`Modifications de salon à valider`),
        paragraph(`${safeRequester} a proposé ${params.fieldsCount} modification(s) pour la fiche du salon <strong>${safeEvent}</strong>. Comparez l'AVANT / APRÈS puis validez ou refusez.`),
      ],
      cta: { label: `Examiner les modifications`, href: ADMIN_URL },
    })
    const { id } = await sendResendEmail({ to: [ADMIN_NOTIFICATION_EMAIL], subject, html })
    console.log(`[event-change] email admin envoyé pour "${params.eventName}" (${id})`)
  } catch (err) {
    console.error('[event-change] exception email admin:', err)
  }
}

// Notif in-app à tous les admins. Ne lève JAMAIS.
async function notifyAdminsInApp(admin: any, params: { eventName: string; requesterName: string }): Promise<void> {
  try {
    const { data: admins, error } = await admin.from('user_roles').select('user_id').eq('role', 'admin')
    if (error) throw error
    const ids = (admins ?? []).map((a: any) => a.user_id).filter(Boolean)
    if (ids.length === 0) { console.warn('[event-change] aucun admin pour la notif in-app'); return }
    const rows = ids.map((adminId: string) => ({
      user_id: adminId,
      type: 'event_change_request',
      category: 'event_mgmt',
      title: 'Modifications de salon à valider',
      message: `${params.requesterName} a proposé des modifications pour le salon ${params.eventName}.`,
      icon: '📝',
      link_url: '/admin/organisateurs',
      read: false,
    }))
    const { error: insErr } = await admin.from('notifications').insert(rows)
    if (insErr) throw insErr
    console.log(`[event-change] notif in-app insérée pour ${ids.length} admin(s)`)
  } catch (err) {
    console.error('[event-change] notif in-app admin échouée (non-bloquant):', err)
  }
}

// Notif à l'organisateur après décision. Ne lève JAMAIS.
async function notifyOrganizer(admin: any, params: { userId: string; eventName: string; approved: boolean }): Promise<void> {
  try {
    const row = {
      user_id: params.userId,
      type: params.approved ? 'event_change_approved' : 'event_change_rejected',
      category: 'event_mgmt',
      title: params.approved ? 'Modifications validées' : 'Modifications refusées',
      message: params.approved
        ? `Vos modifications pour le salon ${params.eventName} ont été validées et sont désormais en ligne.`
        : `Vos modifications proposées pour le salon ${params.eventName} n'ont pas été retenues.`,
      icon: params.approved ? '✅' : '❌',
      link_url: null,
      read: false,
    }
    const { error } = await admin.from('notifications').insert(row)
    if (error) throw error
  } catch (err) {
    console.error('[event-change] notif organisateur échouée (non-bloquant):', err)
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? '')

    // ========================================================================
    // SUBMIT — l'organisateur propriétaire propose des modifications
    // ========================================================================
    if (action === 'submit') {
      const eventId = String(body?.event_id ?? '').trim()
      const changes = (body?.changes && typeof body.changes === 'object') ? body.changes : null
      if (!eventId) return json({ error: 'INVALID_INPUT', message: "L'identifiant du salon est requis." }, 400)
      if (!changes) return json({ error: 'INVALID_INPUT', message: 'Aucune modification fournie.' }, 400)

      const { data: ev } = await admin
        .from('events')
        .select('id, nom_event, date_debut, date_fin, secteur, affluence, tarif, url_image, description_event, description_enrichie, enrichissement_statut, owner_user_id, visible, is_test')
        .eq('id', eventId)
        .maybeSingle()
      if (!ev) return json({ error: 'EVENT_NOT_FOUND', message: 'Salon introuvable.' }, 404)

      // Seul le propriétaire validé peut soumettre
      if (ev.owner_user_id !== user.id)
        return json({ error: 'FORBIDDEN', message: 'Seul le gestionnaire de ce salon peut proposer des modifications.' }, 403)
      if (ev.is_test || !ev.visible)
        return json({ error: 'EVENT_NOT_EDITABLE', message: "Ce salon n'est pas modifiable." }, 400)

      // Construire proposed / previous / changed_fields (uniquement les champs autorisés fournis)
      const proposed: Record<string, any> = {}
      const previous: Record<string, any> = {}
      const changedFields: string[] = []
      for (const field of EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(changes, field) && changes[field] !== undefined) {
          proposed[field] = changes[field]
          if (field === 'description_event') {
            const displayedDesc = (ev.enrichissement_statut === 'valide' && ev.description_enrichie)
              ? ev.description_enrichie
              : (ev.description_event ?? '')
            previous[field] = displayedDesc
          } else {
            previous[field] = (ev as Record<string, any>)[field]
          }
          changedFields.push(field)
        }
      }
      if (changedFields.length === 0)
        return json({ error: 'NO_VALID_CHANGES', message: 'Aucune modification valide à enregistrer.' }, 400)

      // V1 : une seule demande en attente par organisateur/salon -> on remplace la précédente
      await admin
        .from('event_change_requests')
        .delete()
        .eq('event_id', ev.id)
        .eq('requester_user_id', user.id)
        .eq('status', 'pending')

      const { data: cr, error: crErr } = await admin
        .from('event_change_requests')
        .insert({
          event_id: ev.id,
          requester_user_id: user.id,
          status: 'pending',
          changed_fields: changedFields,
          proposed_changes: proposed,
          previous_values: previous,
        })
        .select('id')
        .single()
      if (crErr) {
        console.error('[event-change] insert erreur:', crErr)
        return json({ error: 'SUBMIT_FAILED', message: 'Erreur lors de l\'enregistrement de la demande.' }, 500)
      }

      const requesterName = await resolveRequesterName(admin, user.id, user.email)
      await sendAdminChangeAlertEmail({ eventName: ev.nom_event, requesterName, fieldsCount: changedFields.length })
      await notifyAdminsInApp(admin, { eventName: ev.nom_event, requesterName })

      return json({
        success: true,
        change_request_id: cr.id,
        changed_fields: changedFields,
        message: 'Vos modifications ont été soumises. Elles seront examinées sous 24-48h avant publication.',
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

      const { data: cr } = await admin
        .from('event_change_requests')
        .select('id, requester_user_id, event_id, status')
        .eq('id', requestId)
        .maybeSingle()
      if (!cr) return json({ error: 'CHANGE_NOT_FOUND', message: 'Demande de modification introuvable.' }, 404)

      const { data: ev } = await admin.from('events').select('nom_event').eq('id', cr.event_id).maybeSingle()
      const eventName = ev?.nom_event ?? 'ce salon'

      if (action === 'approve') {
        const { error: rpcErr } = await admin.rpc('admin_apply_event_change', {
          p_request_id: requestId,
          p_admin_user_id: user.id,
        })
        if (rpcErr) {
          console.error('[event-change] approve rpc erreur:', rpcErr)
          return json({ error: 'APPROVE_FAILED', message: rpcErr.message }, 400)
        }
        await notifyOrganizer(admin, { userId: cr.requester_user_id, eventName, approved: true })
        return json({ success: true, event_id: cr.event_id, status: 'approved' })
      } else {
        const note = typeof body?.note === 'string' ? body.note.slice(0, 2000) : null
        const { error: rpcErr } = await admin.rpc('admin_reject_event_change', {
          p_request_id: requestId,
          p_admin_user_id: user.id,
          p_note: note,
        })
        if (rpcErr) {
          console.error('[event-change] reject rpc erreur:', rpcErr)
          return json({ error: 'REJECT_FAILED', message: rpcErr.message }, 400)
        }
        await notifyOrganizer(admin, { userId: cr.requester_user_id, eventName, approved: false })
        return json({ success: true, event_id: cr.event_id, status: 'rejected' })
      }
    }

    return json({ error: 'UNKNOWN_ACTION', message: "Action inconnue. Utilisez 'submit', 'approve' ou 'reject'." }, 400)
  } catch (err) {
    console.error('[event-change] erreur inattendue:', err)
    return json({ error: 'INTERNAL_ERROR', message: 'Une erreur inattendue est survenue.' }, 500)
  }
})
