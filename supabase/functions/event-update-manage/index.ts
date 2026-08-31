import { createClient } from 'npm:@supabase/supabase-js@2'

// ============================================================================
// event-update-manage
// CRUD du Fil du Salon (annonces courtes de l'organisateur).
//
// Securite : l'ecriture n'est autorisee qu'au proprietaire verifie de
// l'evenement (events.owner_user_id) OU a un admin plateforme. Le controle est
// fait en premiere ligne, avant toute mutation. Toutes les ecritures passent par
// le client service_role apres ce controle. Le front n'ecrit jamais en direct :
// event_updates n'a aucune policy RLS pour anon/authenticated.
//
// Actions (body JSON) :
//   update.create    (data, publish?)  -> brouillon, ou publication immediate
//   update.update    (update_id, data) -> edition d'un brouillon ou d'une publiee
//   update.publish   (update_id)       -> draft -> published
//   update.archive   (update_id)       -> draft|published -> archived (terminal)
//
// Machine a etats : draft->published, draft->archived, published->archived.
// Aucun retour en arriere. published_at est fige a la publication et n'est
// jamais modifie par une edition : corriger une faute ne doit pas re-declencher
// la pastille "Nouveau" chez tous les visiteurs.
//
// Le client ne fournit JAMAIS status, published_at, archived_at, source ni
// aucune colonne d'acteur. Ils sont poses ici.
//
// Deployer avec verify_jwt = false (auth geree manuellement ci-dessous).
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

// ---------------------------------------------------------------------------
// Constantes metier (miroir exact des CHECK SQL du lot 1)
// ---------------------------------------------------------------------------
const CATEGORIES = [
  'programme', 'intervenant', 'exposants', 'billetterie', 'exposer', 'pratique', 'autre',
] as const
const CTA_TYPES = ['none', 'programme', 'exposants', 'nouveautes', 'external'] as const

const MESSAGE_MAX = 220
const CTA_LABEL_MAX = 40
const CTA_URL_MAX = 2048

// Caracteres de controle + overrides bidirectionnels Unicode.
// U+202A..U+202E et U+2066..U+2069 permettent d'inverser le sens de lecture
// et donc de deguiser un texte affiche sur une page publique.
const FORBIDDEN_CHARS = /[\u0001-\u001F\u007F\u202A-\u202E\u2066-\u2069]/

// Caracteres invisibles : ils ne sont pas dangereux en eux-memes mais
// permettent de gonfler artificiellement un message ou de casser une
// comparaison. On les retire silencieusement plutot que de refuser.
const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g

// Plafond d'abus, PAS un plafond produit. La decision produit est "aucune
// limite" ; 200 annonces non archivees sur un meme salon releve du bug ou de
// l'abus, pas de l'usage. A relever ou retirer si un salon legitime s'en
// approche.
const MAX_ACTIVE_PER_EVENT = 200

// ---------------------------------------------------------------------------
// Normalisation et validation
// ---------------------------------------------------------------------------

function normalizeText(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(INVISIBLE_CHARS, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

type ValidationError = { error: string; message: string }

/**
 * Valide une URL de CTA externe.
 *
 * Ce lien s'affiche sur une page publique Lotexpo sous la caution visuelle
 * "LE FIL DU SALON". Un organisateur revendique pourrait s'en servir comme
 * support d'hameconnage. On parse reellement l'URL au lieu de se contenter
 * d'une expression reguliere.
 */
function validateCtaUrl(raw: string): ValidationError | null {
  if (raw.length > CTA_URL_MAX) {
    return { error: 'INVALID_INPUT', message: 'Le lien est trop long.' }
  }
  if (FORBIDDEN_CHARS.test(raw) || /\s/.test(raw)) {
    return { error: 'INVALID_INPUT', message: 'Le lien contient des caracteres interdits.' }
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { error: 'INVALID_INPUT', message: "Le lien n'est pas une adresse valide." }
  }

  if (url.protocol !== 'https:') {
    return {
      error: 'INVALID_INPUT',
      message: 'Le lien doit commencer par https:// (les liens non securises ne sont pas acceptes).',
    }
  }

  const host = url.hostname.toLowerCase()
  if (!host) {
    return { error: 'INVALID_INPUT', message: 'Le lien doit comporter un nom de domaine.' }
  }
  // Un nom de domaine public contient au moins un point et n'est pas une IP.
  if (!host.includes('.')) {
    return { error: 'INVALID_INPUT', message: 'Le lien doit pointer vers un domaine public.' }
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    return { error: 'INVALID_INPUT', message: 'Les adresses IP ne sont pas acceptees comme lien.' }
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return { error: 'INVALID_INPUT', message: 'Ce domaine ne peut pas etre utilise comme lien.' }
  }
  // Les identifiants dans l'URL (https://user:pass@site) servent quasi
  // exclusivement a masquer le vrai domaine dans la barre d'adresse.
  if (url.username || url.password) {
    return { error: 'INVALID_INPUT', message: 'Le lien ne doit pas contenir d identifiants.' }
  }

  return null
}

/**
 * Construit le payload d'ecriture a partir des donnees client.
 * Whitelist stricte : tout champ non liste est ignore, y compris status,
 * published_at, archived_at, source et les colonnes d'acteur.
 */
function buildPayload(data: Record<string, any>): { payload: Record<string, any> } | ValidationError {
  const payload: Record<string, any> = {}

  // --- message ---
  const message = normalizeText(data?.message)
  if (!message) {
    return { error: 'INVALID_INPUT', message: 'Le message est requis.' }
  }
  if (message.length > MESSAGE_MAX) {
    return {
      error: 'INVALID_INPUT',
      message: `Le message ne doit pas depasser ${MESSAGE_MAX} caracteres (actuellement ${message.length}).`,
    }
  }
  if (FORBIDDEN_CHARS.test(message)) {
    return {
      error: 'INVALID_INPUT',
      message: 'Le message contient des caracteres interdits (saut de ligne ou caractere de controle).',
    }
  }
  payload.message = message

  // --- categorie ---
  const category = String(data?.category ?? 'autre')
  if (!CATEGORIES.includes(category as any)) {
    return { error: 'INVALID_INPUT', message: 'Categorie inconnue.' }
  }
  payload.category = category

  // --- CTA ---
  const ctaType = String(data?.cta_type ?? 'none')
  if (!CTA_TYPES.includes(ctaType as any)) {
    return { error: 'INVALID_INPUT', message: 'Type de bouton inconnu.' }
  }
  payload.cta_type = ctaType

  if (ctaType === 'external') {
    const label = normalizeText(data?.cta_label)
    if (!label) {
      return { error: 'INVALID_INPUT', message: 'Le libelle du bouton est requis pour un lien externe.' }
    }
    if (label.length > CTA_LABEL_MAX) {
      return {
        error: 'INVALID_INPUT',
        message: `Le libelle du bouton ne doit pas depasser ${CTA_LABEL_MAX} caracteres.`,
      }
    }
    if (FORBIDDEN_CHARS.test(label)) {
      return { error: 'INVALID_INPUT', message: 'Le libelle du bouton contient des caracteres interdits.' }
    }

    const rawUrl = String(data?.cta_url ?? '').trim()
    if (!rawUrl) {
      return { error: 'INVALID_INPUT', message: 'Le lien est requis pour un bouton externe.' }
    }
    const urlError = validateCtaUrl(rawUrl)
    if (urlError) return urlError

    payload.cta_label = label
    payload.cta_url = rawUrl
  } else {
    // Les CTA internes portent un libelle standard impose par le front.
    // Un organisateur ne doit pas pouvoir ecrire "Reserver ma place" sur un
    // lien qui pointe simplement vers l'ancre #programme de sa propre page.
    payload.cta_label = null
    payload.cta_url = null
  }

  // --- expiration ---
  if (data?.expires_at === null || data?.expires_at === undefined || data?.expires_at === '') {
    payload.expires_at = null
  } else {
    const parsed = new Date(String(data.expires_at))
    if (Number.isNaN(parsed.getTime())) {
      return { error: 'INVALID_INPUT', message: "La date d'expiration n'est pas valide." }
    }
    if (parsed.getTime() <= Date.now()) {
      return { error: 'INVALID_INPUT', message: "La date d'expiration doit etre dans le futur." }
    }
    payload.expires_at = parsed.toISOString()
  }

  return { payload }
}

async function logActivity(
  admin: any,
  updateId: string,
  eventId: string,
  actorUserId: string,
  action: 'created' | 'published' | 'edited' | 'archived',
): Promise<void> {
  // Le journal ne doit jamais faire echouer l'action metier.
  try {
    await admin.from('event_update_activity_log').insert({
      event_update_id: updateId,
      event_id: eventId,
      actor_user_id: actorUserId,
      action,
    })
  } catch {
    /* ignore */
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // --- Auth : identifie l'utilisateur via son JWT ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'AUTH_REQUIRED', message: 'Authentification requise.' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return json({ error: 'AUTH_REQUIRED', message: 'Utilisateur non authentifie.' }, 401)
    }
    // Une session anonyme (signInAnonymously, utilisee par la Recherche IA)
    // ne doit jamais pouvoir ecrire.
    if ((user as any).is_anonymous === true) {
      return json({ error: 'AUTH_REQUIRED', message: 'Session anonyme non autorisee.' }, 401)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const raw = await req.text()
    if (raw.length > 8192) {
      return json({ error: 'INVALID_INPUT', message: 'Requete trop volumineuse.' }, 413)
    }
    const body = raw ? JSON.parse(raw) : {}

    const action = String(body?.action ?? '')
    const eventId = String(body?.event_id ?? '').trim()
    if (!eventId) {
      return json({ error: 'INVALID_INPUT', message: "L'identifiant de l'evenement est requis." }, 400)
    }

    // --- Controle d'acces : proprietaire de l'evenement OU admin ---
    const { data: ev } = await admin
      .from('events')
      .select('id, owner_user_id, visible, is_test')
      .eq('id', eventId)
      .maybeSingle()
    if (!ev) return json({ error: 'EVENT_NOT_FOUND', message: 'Evenement introuvable.' }, 404)

    const isAdmin = await isPlatformAdmin(admin, user.id)
    const isOwner = ev.owner_user_id === user.id
    if (!isAdmin && !isOwner) {
      return json(
        { error: 'FORBIDDEN', message: 'Seul le gestionnaire de ce salon peut publier des annonces.' },
        403,
      )
    }

    // Garde-fou : une annonce doit toujours appartenir a cet evenement.
    async function loadUpdate(updateId: string): Promise<any | null> {
      const { data } = await admin
        .from('event_updates')
        .select('id, event_id, status, published_at, archived_at')
        .eq('id', updateId)
        .eq('event_id', eventId)
        .maybeSingle()
      return data ?? null
    }

    // ========================= CREATION =========================
    if (action === 'update.create') {
      const built = buildPayload(body?.data ?? {})
      if ('error' in built) return json(built, 400)

      const { count } = await admin
        .from('event_updates')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .neq('status', 'archived')
      if ((count ?? 0) >= MAX_ACTIVE_PER_EVENT) {
        return json(
          {
            error: 'LIMIT_REACHED',
            message: `Ce salon a atteint ${MAX_ACTIVE_PER_EVENT} annonces non archivees. Archivez-en avant d'en creer de nouvelles.`,
          },
          409,
        )
      }

      const publishNow = body?.publish === true
      const nowIso = new Date().toISOString()

      const { data, error } = await admin
        .from('event_updates')
        .insert({
          ...built.payload,
          event_id: eventId,
          status: publishNow ? 'published' : 'draft',
          published_at: publishNow ? nowIso : null,
          created_by_user_id: user.id,
          last_edited_by_user_id: user.id,
          source: isAdmin && !isOwner ? 'admin' : 'organizer',
        })
        .select('id')
        .single()
      if (error) return json({ error: 'DB_ERROR', message: error.message }, 500)

      await logActivity(admin, data.id, eventId, user.id, 'created')
      if (publishNow) await logActivity(admin, data.id, eventId, user.id, 'published')

      return json({ ok: true, id: data.id, status: publishNow ? 'published' : 'draft' })
    }

    // ========================= EDITION =========================
    if (action === 'update.update') {
      const updateId = String(body?.update_id ?? '').trim()
      const current = updateId ? await loadUpdate(updateId) : null
      if (!current) {
        return json({ error: 'NOT_FOUND', message: 'Annonce introuvable pour ce salon.' }, 404)
      }
      if (current.status === 'archived') {
        return json(
          { error: 'INVALID_STATE', message: 'Une annonce archivee ne peut plus etre modifiee.' },
          409,
        )
      }

      const built = buildPayload(body?.data ?? {})
      if ('error' in built) return json(built, 400)

      // published_at n'est jamais touche : une correction ne doit pas
      // re-declencher la pastille "Nouveau" chez tous les visiteurs.
      const { error } = await admin
        .from('event_updates')
        .update({ ...built.payload, last_edited_by_user_id: user.id })
        .eq('id', updateId)
      if (error) return json({ error: 'DB_ERROR', message: error.message }, 500)

      await logActivity(admin, updateId, eventId, user.id, 'edited')
      return json({ ok: true })
    }

    // ========================= PUBLICATION =========================
    if (action === 'update.publish') {
      const updateId = String(body?.update_id ?? '').trim()
      const current = updateId ? await loadUpdate(updateId) : null
      if (!current) {
        return json({ error: 'NOT_FOUND', message: 'Annonce introuvable pour ce salon.' }, 404)
      }
      if (current.status === 'published') {
        return json({ ok: true, already: true })
      }
      if (current.status !== 'draft') {
        return json(
          { error: 'INVALID_STATE', message: 'Seul un brouillon peut etre publie.' },
          409,
        )
      }

      const { error } = await admin
        .from('event_updates')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          last_edited_by_user_id: user.id,
        })
        .eq('id', updateId)
        .eq('status', 'draft') // garde anti-concurrence : deux onglets ouverts
      if (error) return json({ error: 'DB_ERROR', message: error.message }, 500)

      await logActivity(admin, updateId, eventId, user.id, 'published')
      return json({ ok: true })
    }

    // ========================= ARCHIVAGE =========================
    if (action === 'update.archive') {
      const updateId = String(body?.update_id ?? '').trim()
      const current = updateId ? await loadUpdate(updateId) : null
      if (!current) {
        return json({ error: 'NOT_FOUND', message: 'Annonce introuvable pour ce salon.' }, 404)
      }
      if (current.status === 'archived') {
        return json({ ok: true, already: true })
      }

      // L'archivage est terminal : pas de retour en arriere.
      const { error } = await admin
        .from('event_updates')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          last_edited_by_user_id: user.id,
        })
        .eq('id', updateId)
        .neq('status', 'archived')
      if (error) return json({ error: 'DB_ERROR', message: error.message }, 500)

      await logActivity(admin, updateId, eventId, user.id, 'archived')
      return json({ ok: true })
    }

    return json({ error: 'UNKNOWN_ACTION', message: `Action non reconnue : ${action}` }, 400)

  } catch (error) {
    return json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : String(error),
    }, 500)
  }
})
