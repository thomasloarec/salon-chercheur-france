import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding/base64'

// ============================================================================
// program-pdf-extract (v4 : contrôle de l'édition)
// Extrait le programme d'un evenement depuis un PDF via Claude, avec garde-fou
// anti-fabrication strict. La reponse HTTP est immediate (202) ; le traitement
// lourd (download + IA + parsing) tourne en tache de fond via EdgeRuntime
// .waitUntil. Le frontend suit l'avancement via staging_program_imports.status.
//
// v4 : l'IA ne fournit plus l'annee d'une date. Elle renvoie le jour et le mois,
// le jour de la semaine ecrit et l'annee seulement si elle est imprimee. Le
// serveur reconstruit la date avec l'annee de l'edition et refuse un PDF qui
// concerne visiblement une autre edition (annee imprimee differente, jours de la
// semaine incoherents, dates hors du salon).
//
// Securite : proprietaire de l'evenement OU admin. verify_jwt=false.
// ============================================================================

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined

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

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL = 'claude-sonnet-4-6'
const MAX_PDF_BYTES = 20 * 1024 * 1024
const VALID_TYPES = ['keynote', 'conference', 'table_ronde', 'atelier', 'demo', 'remise_prix', 'networking', 'autre']
const VALID_ROLES = ['intervenant', 'moderateur', 'interviewe', 'animateur']
const MARGIN_DAYS = 2

const EXTRACTION_PROMPT = `Tu extrais le PROGRAMME d'un evenement professionnel a partir du PDF fourni (une brochure).

REGLE ABSOLUE, AUCUNE FABRICATION.
Tu n'extrais QUE ce qui est explicitement ecrit dans le PDF. Tu n'inventes, ne deduis, ni ne completes jamais un champ absent. Si une information n'est pas presente, la valeur est null. Un champ null vaut mieux qu'un champ invente.

DATES, REGLE STRICTE.
Tu ne donnes JAMAIS d'annee deduite. Pour chaque session datee, tu donnes separement :
- jour_mois : "MM-JJ" (mois et jour), uniquement si une date est rattachable a la session ; sinon null.
- jour_semaine : le jour de la semaine tel qu'il est ecrit dans le PDF pour cette date ("lundi", "mardi", "Tuesday", ...), sinon null.
- annee : l'annee UNIQUEMENT si elle est imprimee pour cette date dans le PDF (ex. "17/11/2026", "mardi 17 novembre 2026", ou un en-tete de journee qui la porte) ; sinon null. Ne la complete jamais.
Au niveau du document, annees_imprimees : la liste des annees d'edition imprimees sur le document (couverture, en-tetes, titre "edition 2025", etc.), sans doublon. Liste vide si aucune.

POUR CHAQUE SESSION (conference, atelier, table ronde, keynote, pause, dejeuner, cocktail, ceremonie, etc.) :
- title : le titre exact (obligatoire ; ignore une entree sans titre).
- jour_mois, jour_semaine, annee : voir ci-dessus.
- start_time / end_time : heures "HH:MM" (24h), uniquement si presentes ; sinon null. Ne deduis jamais une heure de fin.
- location : salle/lieu, uniquement si indique ; sinon null.
- track : thematique ou categorie explicite ; sinon null.
- session_type : deduit prudemment du libelle parmi [keynote, conference, table_ronde, atelier, demo, remise_prix, networking, autre]. keynote si "keynote/pleniere d'ouverture" ; atelier si "atelier/workshop/start the day" ; table_ronde si "table ronde/panel/pro&con" ; demo si "demonstration/demo" ; remise_prix si "remise de prix/awards" ; networking si "pause/dejeuner/lunch/cocktail/coffee/networking" ; autre si "ceremonie/ouverture/cloture/questions/q&a/posters". En cas de doute : conference.
- is_highlight : false par defaut. true UNIQUEMENT si le PDF met explicitement la session en avant (keynote, seance pleniere phare, temps fort annonce). Ne fabrique jamais une mise en avant.
- description : texte descriptif present ; sinon null.
- speakers : liste des intervenants de cette session, chacun {ref, role}. role parmi [intervenant, moderateur, interviewe, animateur], "intervenant" par defaut, un autre role UNIQUEMENT s'il est ecrit ("modere par", "anime par").

POUR CHAQUE INTERVENANT (dedoublonne sur tout le document) :
- ref : identifiant court que tu inventes pour relier aux sessions (ex. "p1","p2").
- full_name : nom exact.
- job_title : fonction, uniquement si ecrite ; sinon null.
- company : organisation, uniquement si ecrite ; sinon null.
- linkedin_url : uniquement si une URL LinkedIn figure ; sinon null.
Ne mets jamais de photo. N'invente ni fonction ni entreprise.

DECLARE TON HONNETETE :
- champs_detectes : types d'information reellement trouves, parmi "titres","jours","horaires","salles","thematiques","intervenants","fonctions","entreprises","descriptions","roles".
- champs_non_detectes : types d'information structurants ABSENTS du PDF, pour prevenir l'utilisateur.

SORTIE : un objet JSON STRICT et RIEN d'autre (aucun texte, aucune balise Markdown). Structure exacte :
{
  "annees_imprimees": [],
  "champs_detectes": [],
  "champs_non_detectes": [],
  "speakers": [ { "ref": "p1", "full_name": "", "job_title": null, "company": null, "linkedin_url": null } ],
  "sessions": [ { "title": "", "jour_mois": null, "jour_semaine": null, "annee": null, "start_time": null, "end_time": null, "location": null, "track": null, "session_type": "conference", "is_highlight": false, "description": null, "speakers": [ { "ref": "p1", "role": "intervenant" } ] } ]
}`

async function isPlatformAdmin(admin: any, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('user_roles').select('user_id').eq('user_id', userId).eq('role', 'admin').maybeSingle()
  return !!data
}

function extractJson(text: string): any {
  let t = text.trim()
  t = t.replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

function normStr(v: any): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s === '' ? null : s
}
function normTime(v: any): string | null {
  const s = normStr(v); if (!s) return null
  const m = s.match(/^(\d{1,2})[:hH](\d{2})/); if (!m) return null
  const h = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0')
  return `${h}:${m[2]}`
}
function normMonthDay(v: any): { m: number, d: number } | null {
  const s = normStr(v); if (!s) return null
  const x = s.match(/^(\d{1,2})-(\d{1,2})$/); if (!x) return null
  const m = parseInt(x[1], 10), d = parseInt(x[2], 10)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { m, d }
}
function normYear(v: any): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null
}

const WEEKDAYS: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}
function weekdayIndex(v: any): number | null {
  const s = normStr(v); if (!s) return null
  const k = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
  if (k in WEEKDAYS) return WEEKDAYS[k]
  return null
}

function utcDate(y: number, m: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt
}
function iso(dt: Date): string {
  return dt.toISOString().slice(0, 10)
}
function parseIso(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  const [y, m, d] = s.slice(0, 10).split('-').map((x) => parseInt(x, 10))
  return utcDate(y, m, d)
}

type EventDates = { start: Date | null, end: Date | null }

class EditionMismatch extends Error {}

function normalize(parsed: any, ev: EventDates) {
  const speakersIn = Array.isArray(parsed?.speakers) ? parsed.speakers : []
  const speakers: any[] = []
  const refSet = new Set<string>()
  for (const sp of speakersIn) {
    const full_name = normStr(sp?.full_name); if (!full_name) continue
    const ref = normStr(sp?.ref) ?? full_name
    if (refSet.has(ref)) continue
    refSet.add(ref)
    speakers.push({ ref, full_name, job_title: normStr(sp?.job_title), company: normStr(sp?.company), linkedin_url: normStr(sp?.linkedin_url) })
  }

  const editionYear = ev.start ? ev.start.getUTCFullYear() : null
  const candidateYears = Array.from(new Set([ev.start, ev.end].filter(Boolean).map((d) => (d as Date).getUTCFullYear())))
  const lo = ev.start ? new Date(ev.start.getTime() - MARGIN_DAYS * 86400000) : null
  const hi = ev.end ? new Date(ev.end.getTime() + MARGIN_DAYS * 86400000) : (ev.start ? new Date(ev.start.getTime() + MARGIN_DAYS * 86400000) : null)

  // 1. Annee imprimee sur le document
  const printedYears: number[] = (Array.isArray(parsed?.annees_imprimees) ? parsed.annees_imprimees : [])
    .map(normYear).filter((y: number | null): y is number => y !== null)
  if (editionYear !== null && printedYears.length > 0 && !candidateYears.some((y) => printedYears.includes(y))) {
    throw new EditionMismatch(`Ce PDF semble être le programme de ${printedYears.join(', ')}, alors que ce salon a lieu en ${editionYear}. Importez le programme de l'édition ${editionYear}.`)
  }

  const sessionsIn = Array.isArray(parsed?.sessions) ? parsed.sessions : []
  const sessions: any[] = []
  let dated = 0
  let bad = 0
  const badReasons = new Set<string>()
  for (const s of sessionsIn) {
    const title = normStr(s?.title); if (!title) continue
    let stype = normStr(s?.session_type)
    if (!stype || !VALID_TYPES.includes(stype)) stype = 'conference'
    const spk = Array.isArray(s?.speakers) ? s.speakers : []
    const links: any[] = []
    for (const l of spk) {
      const ref = normStr(l?.ref); if (!ref || !refSet.has(ref)) continue
      let role = normStr(l?.role)
      if (!role || !VALID_ROLES.includes(role)) role = 'intervenant'
      links.push({ ref, role })
    }

    // 2. Date reconstruite avec l'annee de l'edition, puis controlee
    let day_date: string | null = null
    const md = normMonthDay(s?.jour_mois)
    const printedYear = normYear(s?.annee)
    const wd = weekdayIndex(s?.jour_semaine)
    if (md) {
      dated++
      if (editionYear === null) {
        // Evenement sans dates connues : on ne garde que ce qui est imprime.
        const dt = printedYear ? utcDate(printedYear, md.m, md.d) : null
        day_date = dt ? iso(dt) : null
      } else {
        let chosen: Date | null = null
        for (const y of candidateYears) {
          const dt = utcDate(y, md.m, md.d)
          if (dt && lo && hi && dt >= lo && dt <= hi) { chosen = dt; break }
        }
        let problem: string | null = null
        if (!chosen) problem = 'dates hors du salon'
        else if (printedYear !== null && printedYear !== chosen.getUTCFullYear()) problem = `année ${printedYear} imprimée`
        else if (wd !== null && chosen.getUTCDay() !== wd) problem = 'jours de la semaine d\'une autre année'
        if (problem) { bad++; badReasons.add(problem) }
        else day_date = iso(chosen as Date)
      }
    }

    sessions.push({
      title,
      day_date,
      start_time: normTime(s?.start_time),
      end_time: normTime(s?.end_time),
      location: normStr(s?.location),
      track: normStr(s?.track),
      session_type: stype,
      is_highlight: s?.is_highlight === true,
      description: normStr(s?.description),
      speakers: links,
    })
  }

  // 3. Si la majorite des dates ne colle pas a l'edition, c'est un autre programme
  if (editionYear !== null && dated > 0 && bad * 2 > dated) {
    throw new EditionMismatch(`Ce PDF ne semble pas correspondre à l'édition ${editionYear} de ce salon (${Array.from(badReasons).join(', ')}). Importez le programme de cette année.`)
  }
  const avertissements: string[] = []
  if (bad > 0) {
    avertissements.push(`${bad} session(s) sans jour : leur date ne correspondait pas aux dates du salon (${Array.from(badReasons).join(', ')}). Vérifiez-les avant de publier.`)
  }

  const champs_detectes = Array.isArray(parsed?.champs_detectes) ? parsed.champs_detectes.filter((x: any) => typeof x === 'string') : []
  const champs_non_detectes = Array.isArray(parsed?.champs_non_detectes) ? parsed.champs_non_detectes.filter((x: any) => typeof x === 'string') : []
  return { champs_detectes, champs_non_detectes, avertissements, speakers, sessions }
}

// Traitement lourd, execute en tache de fond apres la reponse HTTP.
async function processExtraction(admin: any, importId: string, pdfPath: string, anthropicKey: string, ev: EventDates) {
  try {
    const { data: file, error: dlErr } = await admin.storage.from('program-imports').download(pdfPath)
    if (dlErr || !file) throw new Error('Telechargement du PDF impossible.')
    const buf = new Uint8Array(await file.arrayBuffer())
    if (buf.length === 0) throw new Error('Le PDF est vide.')
    if (buf.length > MAX_PDF_BYTES) throw new Error('PDF trop volumineux (max 20 Mo). Decoupez-le en plusieurs fichiers.')
    const b64 = encodeBase64(buf)

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`Anthropic ${resp.status}: ${t.slice(0, 300)}`)
    }
    const data = await resp.json()
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('')
      : ''
    if (!text) throw new Error('Reponse vide du modele.')
    let parsed: any
    try { parsed = extractJson(text) } catch { throw new Error('Le modele n a pas renvoye de JSON exploitable.') }
    const result = normalize(parsed, ev)
    if (result.sessions.length === 0) throw new Error('Aucune session detectee dans ce PDF.')

    await admin.from('staging_program_imports').update({ result, status: 'extracted' }).eq('id', importId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await admin.from('staging_program_imports').update({ status: 'failed', error: msg.slice(0, 500) }).eq('id', importId)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'AUTH_REQUIRED', message: 'Authentification requise.' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'AUTH_REQUIRED', message: 'Utilisateur non authentifie.' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const eventId = String(body?.event_id ?? '').trim()
    const pdfPath = String(body?.pdf_path ?? '').trim()
    const originalFilename = String(body?.original_filename ?? '').trim() || null
    if (!eventId || !pdfPath) return json({ error: 'INVALID_INPUT', message: 'event_id et pdf_path requis.' }, 400)

    const { data: ev } = await admin.from('events').select('id, owner_user_id, date_debut, date_fin').eq('id', eventId).maybeSingle()
    if (!ev) return json({ error: 'EVENT_NOT_FOUND', message: 'Evenement introuvable.' }, 404)
    const isAdmin = await isPlatformAdmin(admin, user.id)
    if (!isAdmin && ev.owner_user_id !== user.id) {
      return json({ error: 'FORBIDDEN', message: 'Seul le gestionnaire de cet evenement peut importer un programme.' }, 403)
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'CONFIG', message: 'ANTHROPIC_API_KEY absente des secrets.' }, 500)

    const evDates: EventDates = { start: parseIso(ev.date_debut), end: parseIso(ev.date_fin) ?? parseIso(ev.date_debut) }

    const { data: imp, error: insErr } = await admin.from('staging_program_imports')
      .insert({ event_id: eventId, pdf_path: pdfPath, original_filename: originalFilename, status: 'extracting', created_by: user.id, model: MODEL })
      .select('id').single()
    if (insErr || !imp) return json({ error: 'DB_ERROR', message: insErr?.message ?? 'creation staging impossible' }, 500)
    const importId = imp.id

    const task = processExtraction(admin, importId, pdfPath, anthropicKey, evDates)
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(task)
    } else {
      await task
    }

    return json({ ok: true, import_id: importId, status: 'processing' }, 202)
  } catch (error) {
    return json({ error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) }, 500)
  }
})
