// supabase/functions/novelty-pdf-extract/index.ts
//
// LOT 3 — Extraction d'un PDF importé vers les tables de suivi (Lot 2).
// Deux blocs INDÉPENDANTS (règle produit) :
//   - Texte : couche PDF native (unpdf) ; si trop maigre, fallback vision
//             (le PDF est envoyé en bloc `document` à l'API, aucune page rendue
//             chez nous). La provenance est tracée dans text_source.
//   - Images : Version A — copie des JPEG (/DCTDecode) sans réencodage (pdf-lib).
// Un bloc qui échoue n'entraîne jamais l'autre. Le front branche l'UX sur
// text_char_count et image_candidate_count.
//
// Librairies validées en Node sur le corpus réel (comptes = spike mupdf,
// JPEG magic-bytes OK à 100 %). Ce fichier porte cette logique en Deno.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, PDFRawStream, PDFName, PDFRef } from 'npm:pdf-lib@1.17.1';
import { extractText, getDocumentProxy } from 'npm:unpdf';
import { callAnthropic, getAnthropicModelFast } from '../_shared/anthropic.ts';
import { buildCorsHeaders } from '../_shared/cors.ts';

const MAX_TEXTE = 20_000;                 // limite dure du cerveau novelty-ai-draft
const TEXT_MIN_CHARS = 500;               // seuil "couche texte exploitable" (RIKUTEC 292 -> vision)
const VISION_MAX_PAGES = 100;             // limite API PDF
const VISION_MAX_BYTES = 20 * 1024 * 1024; // marge sous les 32 Mo de corps de requête (base64 +33 %)
const IMG_MIN_SIDE = 200;                 // px : écarte icônes/pastilles
const IMG_AR_LO = 0.2, IMG_AR_HI = 5.0;   // ratio d'aspect : écarte bannières/filets
const CANDIDATES_BUCKET = 'novelty-resources'; // privé jusqu'au consentement

const TRANSCRIBE_PROMPT =
  "Transcris fidèlement tout le texte visible de ce document commercial, dans l'ordre de lecture naturel. " +
  "Ne résume pas, ne commente pas, n'ajoute rien qui ne soit écrit dans le document. " +
  "Restitue uniquement le texte tel qu'il apparaît. Si le document ne contient aucun texte lisible ou exploitable (page blanche, image sans texte), réponds EXACTEMENT et UNIQUEMENT par le mot-clé : AUCUN_TEXTE, sans aucune autre phrase et sans décrire l'absence de texte.";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Coupe le texte à MAX_TEXTE sur une frontière de mot. */
function selectText(text: string): { text: string; truncated: boolean } {
  const t = text.trim();
  if (t.length <= MAX_TEXTE) return { text: t, truncated: false };
  const slice = t.slice(0, MAX_TEXTE);
  const cut = slice.lastIndexOf(' ');
  return { text: (cut > MAX_TEXTE * 0.8 ? slice.slice(0, cut) : slice).trim(), truncated: true };
}

/** Fallback vision : envoie le PDF brut au modèle qui le lit visuellement. */
async function visionExtractText(bytes: Uint8Array): Promise<string | null> {
  const res = await callAnthropic({
    apiKey: anthropicKey,
    model: getAnthropicModelFast(),
    maxTokens: 8000,
    userMessage: '',
    content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: toBase64(bytes) } },
      { type: 'text', text: TRANSCRIBE_PROMPT },
    ],
    caller: 'novelty-pdf-extract:vision',
  });
  return res.ok ? res.text : null;
}

/** Version A : images /DCTDecode publiables (hors masques), triées par surface. */
function extractDctCandidates(pdfDoc: PDFDocument) {
  // 1) refs utilisées comme SMask (masques alpha) -> à exclure
  const smaskRefs = new Set<number>();
  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const sm = obj.dict.get(PDFName.of('SMask'));
      if (sm instanceof PDFRef) smaskRefs.add(sm.objectNumber);
    }
  }
  // 2) candidats DCT hors masques, octets JPEG valides
  const cands: Array<{ w: number; h: number; bytes: number; raw: Uint8Array; xref: number }> = [];
  for (const [ref, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    if (smaskRefs.has(ref.objectNumber)) continue;
    const st = obj.dict.lookup(PDFName.of('Subtype'));
    if (!st || st.toString() !== '/Image') continue;
    const f = obj.dict.lookup(PDFName.of('Filter'));
    const fstr = f ? f.toString() : '';
    if (!fstr.includes('DCTDecode')) continue; // Version A : JPEG copiable uniquement
    const w = Number((obj.dict.lookup(PDFName.of('Width')) as any)?.asNumber?.() ?? 0);
    const h = Number((obj.dict.lookup(PDFName.of('Height')) as any)?.asNumber?.() ?? 0);
    const raw = obj.contents;
    if (!raw || raw.length < 3 || raw[0] !== 0xFF || raw[1] !== 0xD8) continue; // magie JPEG
    cands.push({ w, h, bytes: raw.length, raw, xref: ref.objectNumber });
  }
  // 3) filtres déterministes + dédup (dims + Ko)
  const seen = new Set<string>();
  const pub: typeof cands = [];
  for (const c of cands.sort((a, b) => b.w * b.h - a.w * a.h)) {
    if (Math.min(c.w, c.h) < IMG_MIN_SIDE) continue;
    const ar = c.h ? c.w / c.h : 0;
    if (ar < IMG_AR_LO || ar > IMG_AR_HI) continue;
    const key = `${c.w}x${c.h}:${Math.round(c.bytes / 1024)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pub.push(c);
  }
  return pub;
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get('Origin'));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method_not_allowed' }, 405);

  const t0 = Date.now();

  // --- Corps ---
  let body: any;
  try { body = await req.json(); } catch { return jsonResp({ error: 'invalid_json' }, 400); }
  const storage_path = typeof body?.storage_path === 'string' ? body.storage_path : '';
  if (!storage_path) return jsonResp({ error: 'storage_path_requis' }, 400);
  const original_filename = typeof body?.original_filename === 'string' && body.original_filename.trim() !== ''
    ? body.original_filename : null;
  const asUuid = (v: unknown) =>
    typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())
      ? v.trim() : null;
  const exhibitor_id = asUuid(body?.exhibitor_id);
  const event_id = asUuid(body?.event_id);

  // --- Auth : JWT utilisateur (ou service_role + created_by) ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResp({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice('Bearer '.length);
  let callerUserId: string | null = null;
  if (token !== serviceKey) {
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data, error } = await authClient.auth.getClaims(token);
    if (error || !data?.claims?.sub) return jsonResp({ error: 'Unauthorized' }, 401);
    callerUserId = data.claims.sub as string;
  } else {
    callerUserId = typeof body?.created_by === 'string' ? body.created_by : null;
  }
  if (!callerUserId) return jsonResp({ error: 'created_by_indeterminable' }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  // --- Ligne document (status=extracting) ---
  const { data: docRow, error: insErr } = await admin
    .from('novelty_source_documents')
    .insert({
      created_by: callerUserId,
      exhibitor_id,
      event_id,
      storage_bucket: CANDIDATES_BUCKET,
      storage_path,
      original_filename,
      status: 'extracting',
    })
    .select('id')
    .single();
  if (insErr || !docRow) return jsonResp({ error: 'insert_document_failed', details: insErr?.message }, 500);
  const docId = docRow.id as string;

  // --- Téléchargement du PDF ---
  const { data: blob, error: dlErr } = await admin.storage.from(CANDIDATES_BUCKET).download(storage_path);
  if (dlErr || !blob) {
    await admin.from('novelty_source_documents')
      .update({ status: 'failed', error_code: 'download_failed', extraction_ms: Date.now() - t0 })
      .eq('id', docId);
    return jsonResp({ error: 'download_failed', document_id: docId, details: dlErr?.message }, 502);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const fileSize = bytes.length;

  // ============================ BLOC TEXTE ============================
  let textSource: 'none' | 'pdf_layer' | 'vision' = 'none';
  let extractedText = '';
  let rawChars = 0;
  let truncated = false;
  let pageCount: number | null = null;

  try {
    const pdf = await getDocumentProxy(bytes);
    const r: any = await extractText(pdf, { mergePages: true });
    pageCount = typeof r?.totalPages === 'number' ? r.totalPages : null;
    const layer = (r?.text ?? '').trim();
    rawChars = layer.length;

    if (rawChars >= TEXT_MIN_CHARS) {
      textSource = 'pdf_layer';
      const sel = selectText(layer);
      extractedText = sel.text;
      truncated = sel.truncated;
    } else if ((pageCount ?? 999) <= VISION_MAX_PAGES && fileSize <= VISION_MAX_BYTES) {
      const vis = await visionExtractText(bytes);
      const visTrim = (vis ?? '').trim();
      const aucunTexte = visTrim === '' || /^AUCUN_TEXTE[\s.!]*$/i.test(visTrim);
      if (!aucunTexte) {
        textSource = 'vision';
        const sel = selectText(visTrim);
        extractedText = sel.text;
        truncated = sel.truncated;
        rawChars = visTrim.length;
      }
    }
  } catch (e) {
    console.error('[novelty-pdf-extract] bloc texte:', e instanceof Error ? e.message : String(e));
    // le texte reste 'none' ; on continue vers les images
  }

  // ============================ BLOC IMAGES ==========================
  let candidateCount = 0;
  try {
    const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false } as any);
    if (pageCount == null) { try { pageCount = pdfDoc.getPageCount(); } catch { /* noop */ } }

    const pub = extractDctCandidates(pdfDoc);
    let pos = 0;
    for (const c of pub) {
      const path = `${docId}/candidates/${pos + 1}.jpg`;
      const up = await admin.storage.from(CANDIDATES_BUCKET)
        .upload(path, new Blob([c.raw], { type: 'image/jpeg' }), { contentType: 'image/jpeg', upsert: true });
      if (up.error) { console.error('[novelty-pdf-extract] upload image:', up.error.message); continue; }
      const { error: imgErr } = await admin.from('novelty_source_images').insert({
        source_document_id: docId,
        pdf_xref: c.xref,
        source_filter: 'DCT',
        storage_bucket: CANDIDATES_BUCKET,
        storage_path: path,
        width: c.w,
        height: c.h,
        byte_size: c.bytes,
        selected: false,
        position: pos,
      });
      if (imgErr) { console.error('[novelty-pdf-extract] insert image:', imgErr.message); continue; }
      pos++;
    }
    candidateCount = pos;
  } catch (e) {
    console.error('[novelty-pdf-extract] bloc images:', e instanceof Error ? e.message : String(e));
    // les images restent à 0 ; le texte (s'il existe) n'est pas affecté
  }

  // ============================ FINALISATION =========================
  const producedSomething = extractedText.length > 0 || candidateCount > 0;
  const status = producedSomething ? 'extracted' : 'failed';

  await admin.from('novelty_source_documents').update({
    status,
    page_count: pageCount,
    file_size_bytes: fileSize,
    text_source: textSource,
    text_char_count: rawChars,
    text_truncated: truncated,
    extracted_text: extractedText || null,
    image_candidate_count: candidateCount,
    extraction_ms: Date.now() - t0,
    error_code: status === 'failed' ? 'no_content' : null,
  }).eq('id', docId);

  return jsonResp({
    document_id: docId,
    status,
    text_source: textSource,
    text_char_count: rawChars,
    text_truncated: truncated,
    image_candidate_count: candidateCount,
    page_count: pageCount,
  });
});
