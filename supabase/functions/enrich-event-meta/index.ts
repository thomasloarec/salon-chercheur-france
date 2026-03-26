import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts'

/**
 * Edge Function: enrich-event-meta
 * 
 * Enrichit automatiquement les métadonnées SEO d'un événement
 * en appelant l'API Claude (Anthropic) pour générer meta_description_gen.
 * 
 * Modes :
 *   { event_id: string }           → enrichit un seul événement
 *   { batch: true, limit: number } → enrichit un lot d'événements éligibles
 * 
 * V2.1 — Polish final : prompt affiné, secteurs humanisés, dates naturelles.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const MIN_LENGTH = 135;
const MAX_LENGTH = 160;
const IDEAL_MIN = 140;
const IDEAL_MAX = 155;

interface EventData {
  id: string;
  id_event: string | null;
  nom_event: string;
  slug: string | null;
  type_event: string | null;
  secteur: unknown;
  ville: string | null;
  nom_lieu: string | null;
  rue: string | null;
  date_debut: string | null;
  date_fin: string | null;
  description_event: string | null;
  affluence: string | null;
  tarif: string | null;
  url_site_officiel: string | null;
  meta_description_gen: string | null;
  description_enrichie: string | null;
  enrichissement_niveau: string | null;
  enrichissement_statut: string | null;
}

interface EnrichResult {
  id: string;
  id_event: string | null;
  nom_event: string;
  slug: string | null;
  status: 'done' | 'skipped' | 'error';
  reason?: string;
  meta_description_gen?: string;
  length?: number;
  enrichissement_date?: string;
  retried?: boolean;
  retry_reason?: string;
  description_enrichie_status?: 'done' | 'skipped' | 'error';
  description_enrichie_reason?: string;
}

/* ─── DATE FORMATTING (natural French) ─── */
function formatDateFr(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleDateString('fr-FR', { month: 'long' });
    const year = d.getFullYear();
    return `${day === 1 ? '1er' : day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

/** Format a date range naturally: "du 1er au 3 avril 2026" or "du 28 mars au 2 avril 2026" */
function formatDateRangeFr(debut: string | null, fin: string | null): string {
  if (!debut) return '';
  if (!fin || debut === fin) return `le ${formatDateFr(debut)}`;
  try {
    const dStart = new Date(debut);
    const dEnd = new Date(fin);
    const sameMonth = dStart.getMonth() === dEnd.getMonth() && dStart.getFullYear() === dEnd.getFullYear();
    const dayStart = dStart.getDate();
    const dayEnd = dEnd.getDate();
    if (sameMonth) {
      const month = dStart.toLocaleDateString('fr-FR', { month: 'long' });
      const year = dStart.getFullYear();
      return `du ${dayStart === 1 ? '1er' : dayStart} au ${dayEnd === 1 ? '1er' : dayEnd} ${month} ${year}`;
    }
    return `du ${formatDateFr(debut)} au ${formatDateFr(fin)}`;
  } catch {
    return `du ${formatDateFr(debut)} au ${formatDateFr(fin)}`;
  }
}

/* ─── HUMANIZE SECTOR NAMES ─── */
const SECTOR_REWRITES: Record<string, string> = {
  'Santé & Médical': 'la santé',
  'Commerce & Distribution': 'le commerce et la distribution',
  'Industrie & Production': "l'industrie et la production",
  'BTP & Construction': 'le BTP et la construction',
  'Technologie & Innovation': "la technologie et l'innovation",
  'Mode & Textile': 'la mode et le textile',
  'Art & Culture': "l'art et la culture",
  'Agroalimentaire & Agriculture': "l'agroalimentaire et l'agriculture",
  'Énergie & Environnement': "l'énergie et l'environnement",
  'Transport & Logistique': 'le transport et la logistique',
  'Éducation & Formation': "l'éducation et la formation",
  'Tourisme & Hôtellerie': "le tourisme et l'hôtellerie",
  'Sport & Loisirs': 'le sport et les loisirs',
  'Défense & Sécurité': 'la défense et la sécurité',
  'Immobilier & Habitat': "l'immobilier et l'habitat",
  'Luxe & Horlogerie': "le luxe et l'horlogerie",
  'Numérique & Digital': 'le numérique',
  'Automobile & Mobilité': "l'automobile et la mobilité",
  'Aéronautique & Spatial': "l'aéronautique et le spatial",
};

function humanizeSector(raw: string): string {
  const trimmed = raw.trim();
  return SECTOR_REWRITES[trimmed] ?? trimmed.toLowerCase();
}

/* ─── EXTRACT SECTORS ─── */
function extractSectors(secteur: unknown): string {
  if (!secteur) return '';
  if (Array.isArray(secteur)) {
    const flat = secteur.flatMap((s: unknown) => Array.isArray(s) ? s : [s]).filter(Boolean);
    return flat.map(s => humanizeSector(String(s))).join(', ');
  }
  const str = String(secteur);
  if (str === '[]' || str === 'null') return '';
  return humanizeSector(str);
}

/* ─── BUILD PROMPT (ordered data priority) ─── */
function buildPrompt(event: EventData): string {
  const parts: string[] = [];

  parts.push(`Nom de l'événement : ${event.nom_event}`);
  if (event.ville) parts.push(`Ville : ${event.ville}`);

  const dateRange = formatDateRangeFr(event.date_debut, event.date_fin);
  if (dateRange) parts.push(`Dates : ${dateRange}`);

  if (event.type_event) parts.push(`Type : ${event.type_event}`);

  const secteurs = extractSectors(event.secteur);
  if (secteurs) parts.push(`Secteur(s) : ${secteurs}`);

  if (event.nom_lieu) parts.push(`Lieu : ${event.nom_lieu}`);
  if (event.affluence) parts.push(`Affluence estimée : ${event.affluence} visiteurs`);

  if (event.description_event) {
    const desc = event.description_event.replace(/<[^>]*>/g, '').slice(0, 400);
    parts.push(`Description (à utiliser uniquement pour reformulation factuelle, ne rien inventer à partir de ce texte) : ${desc}`);
  }

  return parts.join('\n');
}

/* ─── SYSTEM PROMPT V2.1 — POLISH FINAL ─── */
const SYSTEM_PROMPT = `Tu es un rédacteur de meta descriptions pour des pages de salons professionnels en France.

OBJECTIF : Produire UNE meta description factuelle, sobre, naturelle et complète.

STYLE :
- Ton strictement factuel et naturel.
- Phrases fluides, lisibles, en bon français.
- Sobre : pas de ton promotionnel, pas de superlatifs, pas de formulation commerciale.
- Pas de bénéfice implicite ni de promesse.

FORMULATIONS À ÉVITER (sauf si strictement fondé dans les données) :
- "propose", "réunit", "rassemble", "permet de"
- "découvrez", "rendez-vous de/des", "pour les professionnels de"
- "incontournable", "à ne pas manquer", "unique"

INTÉGRATION DES SECTEURS :
- Les noms de secteurs fournis sont déjà reformulés en français naturel.
- Intègre-les naturellement dans la phrase, par exemple :
  "consacré à la santé", "dédié au BTP et à la construction", "centré sur le numérique".
- N'utilise JAMAIS les noms de secteurs bruts avec "&" ou majuscules.

RÈGLES ABSOLUES :
1. Utilise UNIQUEMENT les informations fournies. N'invente RIEN.
2. Ne déduis AUCUN positionnement métier qui n'est pas explicitement présent.
3. La description_event sert uniquement d'aide à la reformulation factuelle. Ne l'utilise pas pour inventer ou enrichir librement.
4. Préfère une phrase simple et exacte plutôt qu'une phrase plus riche mais incertaine.

FORMAT :
- Longueur : entre 140 et 155 caractères exactement. Vise 145-150 si possible.
- La phrase DOIT être complète, lisible et terminée par un point.
- JAMAIS de phrase tronquée ou coupée.
- Pas de guillemets autour du résultat.
- Pas de préfixe comme "Meta description :" ou "Voici :".

STRUCTURES EXEMPLES (varier légèrement, rester homogène) :
- "{nom_event} à {ville} {dates} : {type_event} consacré à {secteur}, à {nom_lieu}."
- "{nom_event}, {type_event} à {ville} {dates}, dédié à {secteur}."
- "{nom_event} se tient à {ville} {dates}. Ce {type_event} est consacré à {secteur}."

Si certaines données sont absentes, produis une meta plus simple. Ne compense JAMAIS par une supposition.

Réponds UNIQUEMENT avec la meta description, rien d'autre.`;

/* ─── RETRY PROMPT ─── */
const RETRY_PROMPT = `La meta description précédente ne respecte pas les critères de qualité.

Réécris-la en respectant strictement ces règles :
- Entre 140 et 155 caractères exactement (vise 145-150).
- Phrase complète terminée par un point.
- Strictement factuelle, sans rien inventer.
- Pas de phrase tronquée.
- Sobre, sans ton marketing ni superlatif.
- Pas de formulations comme "propose", "réunit", "rassemble", "permet de", "découvrez".
- Intègre les secteurs naturellement (pas de "&" ou majuscules brutes).

Réponds UNIQUEMENT avec la meta description corrigée, rien d'autre.`;

/* ─── QUALITY VALIDATION ─── */
interface ValidationResult {
  valid: boolean;
  reason?: string;
}

function validateMeta(meta: string): ValidationResult {
  if (!meta || meta.trim() === '') {
    return { valid: false, reason: 'Meta vide' };
  }

  const trimmed = meta.trim();
  const len = trimmed.length;

  // Too short
  if (len < MIN_LENGTH) {
    return { valid: false, reason: `Trop courte (${len} car., min ${MIN_LENGTH})` };
  }

  // Too long
  if (len > MAX_LENGTH) {
    return { valid: false, reason: `Trop longue (${len} car., max ${MAX_LENGTH})` };
  }

  // Truncated: ends without proper punctuation and looks cut
  const lastChar = trimmed[trimmed.length - 1];
  const properEndings = ['.', '!', '?', '…'];
  if (!properEndings.includes(lastChar)) {
    // Check if it looks like a complete thought anyway (e.g., ends with a word)
    // But if it ends mid-word or with comma/colon, it's truncated
    if ([',', ':', ';', '-', '–'].includes(lastChar)) {
      return { valid: false, reason: 'Phrase coupée (ponctuation incomplète)' };
    }
    // No final punctuation — likely truncated
    return { valid: false, reason: 'Phrase sans ponctuation finale' };
  }

  // Starts with unwanted prefix
  const lowerMeta = trimmed.toLowerCase();
  if (lowerMeta.startsWith('meta description') || lowerMeta.startsWith('voici')) {
    return { valid: false, reason: 'Contient un préfixe non désiré' };
  }

  return { valid: true };
}

/* ─── CALL CLAUDE ─── */
async function callClaude(
  anthropicKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<{ text: string | null; error?: string }> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: userMessage }],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { text: null, error: `Claude API ${response.status}: ${errorText.slice(0, 200)}` };
    }

    const result = await response.json();
    const text = result?.content?.[0]?.text?.trim() ?? null;
    return { text };
  } catch (err) {
    return { text: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/* ─── ENRICH SINGLE EVENT (with retry) ─── */
async function enrichSingleEvent(
  supabase: ReturnType<typeof createClient>,
  event: EventData,
  anthropicKey: string,
): Promise<EnrichResult> {
  const base = { id: event.id, id_event: event.id_event, nom_event: event.nom_event, slug: event.slug };

  // Guard: already has meta
  if (event.meta_description_gen && event.meta_description_gen.trim() !== '') {
    return { ...base, status: 'skipped', reason: 'meta_description_gen déjà remplie' };
  }

  // Guard: past event
  const today = new Date().toISOString().slice(0, 10);
  const endDate = event.date_fin?.slice(0, 10) ?? event.date_debut?.slice(0, 10);
  if (endDate && endDate < today) {
    return { ...base, status: 'skipped', reason: 'Événement passé' };
  }

  // Guard: missing data
  if (!event.nom_event || event.nom_event.trim() === '') {
    return { ...base, status: 'skipped', reason: 'Données insuffisantes (nom manquant)' };
  }

  // Mark pending
  await supabase
    .from('events')
    .update({ enrichissement_statut: 'pending', enrichissement_date: new Date().toISOString() })
    .eq('id', event.id);

  try {
    const userMessage = buildPrompt(event);

    // ─── Attempt 1 ───
    console.log(`🤖 [Attempt 1] Appel Claude pour : ${event.nom_event}`);
    const attempt1 = await callClaude(anthropicKey, SYSTEM_PROMPT, userMessage);

    if (attempt1.error) {
      console.error(`❌ Claude error attempt 1:`, attempt1.error);
      await markError(supabase, event.id);
      return { ...base, status: 'error', reason: attempt1.error };
    }

    let meta = attempt1.text ?? '';
    // Remove quotes if wrapped
    if ((meta.startsWith('"') && meta.endsWith('"')) || (meta.startsWith('«') && meta.endsWith('»'))) {
      meta = meta.slice(1, -1).trim();
    }

    let validation = validateMeta(meta);
    let retried = false;
    let retryReason: string | undefined;

    // ─── Attempt 2 (retry) if validation fails ───
    if (!validation.valid) {
      retried = true;
      retryReason = validation.reason;
      console.log(`🔄 [Retry] ${event.nom_event} — raison: ${validation.reason}`);

      const retryMessage = `Données de l'événement :\n${userMessage}\n\nMeta description précédente (non valide) :\n"${meta}"\n\nProblème : ${validation.reason}`;
      const attempt2 = await callClaude(anthropicKey, RETRY_PROMPT, retryMessage);

      if (attempt2.error) {
        console.error(`❌ Claude error attempt 2:`, attempt2.error);
        await markError(supabase, event.id);
        return { ...base, status: 'error', reason: `Retry échoué: ${attempt2.error}`, retried: true, retry_reason: retryReason };
      }

      meta = attempt2.text ?? '';
      if ((meta.startsWith('"') && meta.endsWith('"')) || (meta.startsWith('«') && meta.endsWith('»'))) {
        meta = meta.slice(1, -1).trim();
      }

      validation = validateMeta(meta);
    }

    // ─── Final validation ───
    if (!validation.valid) {
      console.error(`❌ Validation échouée après retry pour ${event.nom_event}: ${validation.reason}`);
      await supabase
        .from('events')
        .update({ enrichissement_statut: 'error', enrichissement_date: new Date().toISOString() })
        .eq('id', event.id);
      return {
        ...base,
        status: 'error',
        reason: `Qualité insuffisante après retry: ${validation.reason}`,
        meta_description_gen: meta,
        length: meta.length,
        retried: true,
        retry_reason: retryReason,
      };
    }

    // ─── Save ───
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('events')
      .update({
        meta_description_gen: meta,
        enrichissement_statut: 'done',
        enrichissement_date: now,
      })
      .eq('id', event.id);

    if (updateError) {
      console.error('❌ Erreur sauvegarde meta:', updateError.message);
      return { ...base, status: 'error', reason: 'Erreur sauvegarde DB' };
    }

    const inIdealRange = meta.length >= IDEAL_MIN && meta.length <= IDEAL_MAX;
    console.log(`✅ Meta OK pour ${event.nom_event} (${meta.length} car.${retried ? ', après retry' : ''}${inIdealRange ? '' : ', hors cible idéale'}): "${meta}"`);

    return {
      ...base,
      status: 'done',
      meta_description_gen: meta,
      length: meta.length,
      enrichissement_date: now,
      retried,
      retry_reason: retryReason,
    };
  } catch (err) {
    console.error(`❌ Erreur enrichissement ${event.nom_event}:`, err);
    await markError(supabase, event.id);
    return { ...base, status: 'error', reason: err instanceof Error ? err.message : String(err) };
  }
}

async function markError(supabase: ReturnType<typeof createClient>, eventId: string) {
  await supabase
    .from('events')
    .update({ enrichissement_statut: 'error', enrichissement_date: new Date().toISOString() })
    .eq('id', eventId);
}

/* ═══════════════════════════════════════════════════════════════
   DESCRIPTION ENRICHIE — Pilot phase
   ═══════════════════════════════════════════════════════════════ */

const PILOT_SLUGS = [
  'fip-solution-plastique',
  'carrefour-international-du-bois',
  'sepem-brest',
  'in-cosmetics-global',
  'food-hotel-tech',
  'medfel',
];

const DESC_ENRICHIE_SYSTEM_PROMPT = `Tu es un rédacteur expert en événements professionnels B2B français.

Tu rédiges des descriptions enrichies pour des fiches de salons professionnels
sur Lotexpo, la plateforme de référence des événements pro en France.

Ton objectif : produire un texte utile pour deux audiences simultanément.

1. Un professionnel qui évalue si ce salon vaut son déplacement.
2. Google, qui doit comprendre de quoi parle cette page et la classer
   sur des requêtes comme "[nom du salon] [année]" ou
   "salon [secteur] [ville] [année]".

RÈGLES ABSOLUES :
- Tu n'inventes AUCUNE information. Tu travailles uniquement avec
  les données fournies dans le prompt utilisateur.
- Si une donnée est absente ou marquée "non communiqué",
  tu ne la mentionnes pas. Tu ne la devines pas.
- Tu ne répètes pas mot pour mot la description existante.
  Tu l'enrichis, la restructures, l'approfondis.
- Longueur cible : 350 à 500 mots.
- Structure attendue (sans titres visibles dans le texte) :
    § 1 — Contexte et positionnement du salon (2-3 phrases)
    § 2 — Ce qu'on y trouve : exposants, secteurs, thématiques (3-4 phrases)
    § 3 — À qui s'adresse cet événement, pourquoi y aller (3-4 phrases)
    § 4 — Informations pratiques clés : lieu, dates, accès, tarif (2-3 phrases)
- Ton : professionnel, factuel, direct. Pas de superlatifs.
  Pas de "incontournable", "unique", "exceptionnel".
- Ne mentionne JAMAIS un nombre d'exposants,
  un nombre de halls ou un numéro d'édition
  s'il n'apparaît pas mot pour mot dans les données fournies.
- Ne mentionne JAMAIS un nom d'espace thématique,
  de zone ou de programme (ex: 'FIP Materials',
  'espace innovation') s'il ne figure pas dans
  les données fournies.
- Ne déduis jamais d'informations spécifiques
  à partir du secteur ou du type d'événement.
- En cas de doute sur une information, l'omettre
  complètement. Une formulation générale exacte
  vaut mieux qu'un détail plausible inventé.
- Tu retournes uniquement le texte rédigé, sans titre,
  sans balise, sans commentaire.`;

function buildDescEnrichiePrompt(event: EventData): string {
  const parts: string[] = ['Voici les données de l\'événement à traiter :\n'];
  parts.push(`NOM : ${event.nom_event}`);

  const secteurs = extractSectors(event.secteur);
  parts.push(`SECTEUR(S) : ${secteurs || 'non communiqué'}`);
  parts.push(`TYPE D'ÉVÉNEMENT : ${event.type_event || 'non communiqué'}`);
  parts.push(`VILLE : ${event.ville || 'non communiqué'}`);
  parts.push(`LIEU : ${event.nom_lieu || 'non communiqué'}`);
  parts.push(`ADRESSE : ${event.rue || 'non communiqué'}`);

  const dateRange = formatDateRangeFr(event.date_debut, event.date_fin);
  parts.push(`DATES : ${dateRange || 'non communiqué'}`);
  parts.push(`AFFLUENCE ATTENDUE : ${event.affluence || 'non communiqué'}`);
  parts.push(`TARIF : ${event.tarif || 'non communiqué'}`);
  parts.push(`SITE OFFICIEL : ${event.url_site_officiel || 'non communiqué'}`);

  if (event.description_event) {
    const desc = event.description_event.replace(/<[^>]*>/g, '').slice(0, 2000);
    parts.push(`\nDESCRIPTION ACTUELLE (à enrichir, ne pas copier) :\n${desc}`);
  } else {
    parts.push(`\nDESCRIPTION ACTUELLE : non communiqué`);
  }

  parts.push('\nRédige la description enrichie.');
  return parts.join('\n');
}

/** Check if an event is eligible for description_enrichie generation */
function isEligibleForDescEnrichie(event: EventData): { eligible: boolean; reason?: string } {
  // Must be a pilot slug
  if (!event.slug || !PILOT_SLUGS.includes(event.slug)) {
    return { eligible: false, reason: 'Slug non inclus dans le pilote' };
  }
  // Must be premium
  if (event.enrichissement_niveau !== 'premium') {
    return { eligible: false, reason: `Niveau "${event.enrichissement_niveau}" (premium requis)` };
  }
  // Must not already have a description_enrichie
  if (event.description_enrichie && event.description_enrichie.trim() !== '') {
    return { eligible: false, reason: 'description_enrichie déjà remplie' };
  }
  // Must be non_traite (for this specific flow)
  if (event.enrichissement_statut && event.enrichissement_statut !== 'non_traite' && event.enrichissement_statut !== 'done') {
    return { eligible: false, reason: `Statut "${event.enrichissement_statut}" (non_traite requis)` };
  }
  // Must be a future event
  const today = new Date().toISOString().slice(0, 10);
  if (!event.date_debut || event.date_debut.slice(0, 10) <= today) {
    return { eligible: false, reason: 'Événement passé ou sans date' };
  }
  return { eligible: true };
}

/** Generate description_enrichie for a single event */
async function enrichDescription(
  supabase: ReturnType<typeof createClient>,
  event: EventData,
  anthropicKey: string,
): Promise<{ status: 'done' | 'skipped' | 'error'; reason?: string }> {
  const eligibility = isEligibleForDescEnrichie(event);
  if (!eligibility.eligible) {
    return { status: 'skipped', reason: eligibility.reason };
  }

  console.log(`📝 [Desc enrichie] Appel Claude pour : ${event.nom_event}`);

  const userMessage = buildDescEnrichiePrompt(event);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: userMessage }],
        system: DESC_ENRICHIE_SYSTEM_PROMPT,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Desc enrichie] Claude API ${response.status}: ${errorText.slice(0, 200)}`);
      return { status: 'error', reason: `Claude API ${response.status}` };
    }

    const result = await response.json();
    const text = result?.content?.[0]?.text?.trim() ?? '';

    // ─── Garde-fous ───
    if (text.length < 300) {
      console.error(`❌ [Desc enrichie] Texte trop court (${text.length} car.) pour ${event.nom_event}`);
      return { status: 'error', reason: `Texte trop court: ${text.length} caractères (min 300)` };
    }

    if (text.includes('[NON RENSEIGNÉ]')) {
      console.error(`❌ [Desc enrichie] Contient "[NON RENSEIGNÉ]" pour ${event.nom_event}`);
      return { status: 'error', reason: 'Contient "[NON RENSEIGNÉ]"' };
    }

    // ─── Écriture en DB ───
    const { error: updateError } = await supabase
      .from('events')
      .update({
        description_enrichie: text,
        enrichissement_statut: 'en_attente',
        enrichissement_date: new Date().toISOString(),
      })
      .eq('id', event.id);

    if (updateError) {
      console.error(`❌ [Desc enrichie] Erreur sauvegarde:`, updateError.message);
      return { status: 'error', reason: `Erreur DB: ${updateError.message}` };
    }

    console.log(`✅ [Desc enrichie] OK pour ${event.nom_event} (${text.length} car.)`);
    return { status: 'done' };

  } catch (err) {
    console.error(`❌ [Desc enrichie] Erreur pour ${event.nom_event}:`, err);
    return { status: 'error', reason: err instanceof Error ? err.message : String(err) };
  }
}

/* ─── SELECT FIELDS ─── */
const SELECT_FIELDS = 'id, id_event, nom_event, slug, type_event, secteur, ville, nom_lieu, rue, date_debut, date_fin, description_event, affluence, tarif, url_site_officiel, meta_description_gen, description_enrichie, enrichissement_niveau, enrichissement_statut';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    const corsResult = handleCors(req);
    if (corsResult instanceof Response) return corsResult;
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const body = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY non configurée');
      return new Response(JSON.stringify({ error: 'Configuration manquante' }), { status: 500, headers: jsonHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ─── BATCH MODE ───
    if (body.batch === true) {
      const MAX_BATCH = 20;
      const rawLimit = Number(body.limit) || 10;
      const limit = Math.min(Math.max(rawLimit, 1), MAX_BATCH);
      if (rawLimit > MAX_BATCH) {
        console.warn(`⚠️ Limite demandée (${rawLimit}) ramenée à ${MAX_BATCH}`);
      }
      const today = new Date().toISOString().slice(0, 10);

      console.log(`📦 Batch enrichissement V2 — limit: ${limit}`);

      const { data: events, error: fetchErr } = await supabase
        .from('events')
        .select(SELECT_FIELDS)
        .eq('visible', true)
        .eq('is_test', false)
        .gte('date_debut', today)
        .or('meta_description_gen.is.null,meta_description_gen.eq.')
        .order('date_debut', { ascending: true })
        .limit(limit);

      if (fetchErr) {
        console.error('❌ Fetch batch events error:', fetchErr.message);
        return new Response(JSON.stringify({ error: 'Erreur récupération événements', details: fetchErr.message }), { status: 500, headers: jsonHeaders });
      }

      if (!events || events.length === 0) {
        return new Response(JSON.stringify({ batch: true, total: 0, results: [], message: 'Aucun événement éligible trouvé' }), { status: 200, headers: jsonHeaders });
      }

      console.log(`📋 ${events.length} événements éligibles trouvés`);

      const results: EnrichResult[] = [];
      for (const ev of events) {
        const result = await enrichSingleEvent(supabase, ev as EventData, ANTHROPIC_API_KEY);
        // After meta enrichment, attempt description_enrichie for eligible events
        const descResult = await enrichDescription(supabase, ev as EventData, ANTHROPIC_API_KEY);
        result.description_enrichie_status = descResult.status;
        result.description_enrichie_reason = descResult.reason;
        results.push(result);
      }

      const done = results.filter(r => r.status === 'done').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const errors = results.filter(r => r.status === 'error').length;
      const retried = results.filter(r => r.retried).length;
      const descDone = results.filter(r => r.description_enrichie_status === 'done').length;

      console.log(`📦 Batch V2 terminé — meta: done=${done}, skipped=${skipped}, errors=${errors}, retried=${retried} | desc_enrichie: done=${descDone}`);

      return new Response(JSON.stringify({
        batch: true,
        total: results.length,
        done,
        skipped,
        errors,
        retried,
        description_enrichie_done: descDone,
        results,
      }), { status: 200, headers: jsonHeaders });
    }

    // ─── SINGLE EVENT MODE ───
    const { event_id } = body;

    if (!event_id || typeof event_id !== 'string') {
      return new Response(JSON.stringify({ error: 'event_id requis' }), { status: 400, headers: jsonHeaders });
    }

    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select(SELECT_FIELDS)
      .eq('id', event_id)
      .maybeSingle();

    if (fetchError || !event) {
      console.error('❌ Événement non trouvé:', event_id, fetchError?.message);
      return new Response(JSON.stringify({ error: 'Événement non trouvé' }), { status: 404, headers: jsonHeaders });
    }

    const result = await enrichSingleEvent(supabase, event as EventData, ANTHROPIC_API_KEY);
    // Also attempt description_enrichie
    const descResult = await enrichDescription(supabase, event as EventData, ANTHROPIC_API_KEY);
    result.description_enrichie_status = descResult.status;
    result.description_enrichie_reason = descResult.reason;

    const statusCode = result.status === 'error' ? 500 : 200;
    return new Response(JSON.stringify(result), { status: statusCode, headers: jsonHeaders });

  } catch (error) {
    console.error('❌ Erreur générale enrichissement:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
