// supabase/functions/novelty-images-qualify/index.ts
//
// LOT 4 — Qualification des images candidates d'un document PDF.
// Envoie TOUTES les images candidates en un seul appel au modèle rapide, qui
// classe chacune (photo produit / ambiance / schéma / logo / badge / portrait /
// capture / décor) et lui donne une note d'aptitude comme illustration de
// Nouveauté. Écrit kind + score dans novelty_source_images, puis marque les
// 3 meilleures images "hero-compatibles" comme sélection suggérée (cap = 3,
// aligné sur novelties.images_count <= 3).
//
// Réutilise la plomberie multimodale déjà prouvée en prod (le fallback vision
// du Lot 3). Aucun changement de helper, aucune nouvelle dépendance.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { callAnthropic, getAnthropicModelFast } from '../_shared/anthropic.ts';
import { buildCorsHeaders } from '../_shared/cors.ts';

const SOURCE_BUCKET = 'novelty-resources';
const ALLOWED_KINDS = new Set([
  'product_photo', 'ambiance', 'diagram', 'logo', 'badge', 'portrait', 'screenshot', 'decor', 'unknown',
]);
// Types réellement montrables comme illustration principale d'une nouveauté.
const HERO_KINDS = new Set(['product_photo', 'ambiance', 'diagram']);
const MAX_IMAGES_PER_CALL = 20;      // borne par appel ; on découpe au-delà
const MAX_IMG_BYTES = 5 * 1024 * 1024; // limite API par image
const SELECT_CAP = 3;                 // novelties.images_count <= 3

const QUALIFY_SYSTEM = `Tu qualifies des images extraites de la plaquette d'un exposant, pour décider lesquelles peuvent illustrer l'annonce d'une nouveauté produit sur une plateforme B2B.

Pour CHAQUE image, tu donnes deux choses :

1) "kind", exactement l'une de ces valeurs :
- product_photo : photo du produit lui-même, détouré ou en situation neutre.
- ambiance : le produit en contexte d'usage, scène de vie ou de travail, mise en situation.
- diagram : schéma technique, plan, dessin coté, vue éclatée, graphique.
- logo : logo d'entreprise ou de marque.
- badge : pastille de certification, label, récompense, pictogramme normatif (ISO, CE, SGS, etc.).
- portrait : photo centrée sur une personne identifiable (visage au premier plan).
- screenshot : capture d'écran d'un logiciel ou d'une interface.
- decor : texture, fond, aplat purement décoratif, sans information.
- unknown : rien de ce qui précède, ou image illisible.

2) "score", un entier de 0 à 100 : aptitude à servir d'illustration principale d'une nouveauté.
- product_photo et ambiance nettes et lisibles : 70 à 100.
- diagram informatif : 40 à 70.
- logo, badge, screenshot, decor : 0 à 25.
- portrait : au maximum 20. On ne met jamais en avant une personne identifiable sans consentement.
- À l'intérieur d'une même catégorie, une image plus nette, mieux cadrée, plus parlante obtient une note plus haute.

Tu reçois les images numérotées "Image 0:", "Image 1:", etc. Tu réponds UNIQUEMENT avec un objet JSON, sans aucun texte autour, de la forme :
{"images":[{"index":0,"kind":"product_photo","score":82},{"index":1,"kind":"badge","score":10}]}
Une entrée par image, dans l'ordre, avec l'index qui correspond au numéro affiché.`;

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

function tryParseJson(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  const s = text.indexOf('{'); const e = text.lastIndexOf('}');
  if (s >= 0 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch { /* noop */ } }
  return null;
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get('Origin'));
  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return jsonResp({ error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return jsonResp({ error: 'invalid_json' }, 400); }
  const document_id = typeof body?.document_id === 'string' ? body.document_id : '';
  if (!document_id) return jsonResp({ error: 'document_id_requis' }, 400);

  // --- Auth : JWT utilisateur (ownership) ou service_role ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResp({ error: 'Unauthorized' }, 401);
  const token = authHeader.slice('Bearer '.length);
  let callerUserId: string | null = null;
  let isService = false;
  if (token !== serviceKey) {
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data, error } = await authClient.auth.getClaims(token);
    if (error || !data?.claims?.sub) return jsonResp({ error: 'Unauthorized' }, 401);
    callerUserId = data.claims.sub as string;
  } else {
    isService = true;
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // --- Document + contrôle de propriété ---
  const { data: doc, error: docErr } = await admin
    .from('novelty_source_documents')
    .select('id, created_by')
    .eq('id', document_id)
    .maybeSingle();
  if (docErr || !doc) return jsonResp({ error: 'document_introuvable' }, 404);
  if (!isService && doc.created_by !== callerUserId) return jsonResp({ error: 'Forbidden' }, 403);

  // --- Images candidates ---
  const { data: images, error: imgErr } = await admin
    .from('novelty_source_images')
    .select('id, position, storage_bucket, storage_path, width, height, byte_size')
    .eq('source_document_id', document_id)
    .order('position', { ascending: true });
  if (imgErr) return jsonResp({ error: 'lecture_images_failed', details: imgErr.message }, 500);
  if (!images || images.length === 0) return jsonResp({ document_id, qualified: 0, selected: 0 });

  // --- Téléchargement + base64 ---
  type Cand = { id: string; b64: string | null };
  const cands: Cand[] = [];
  for (const im of images) {
    if ((im.byte_size ?? 0) > MAX_IMG_BYTES) { cands.push({ id: im.id, b64: null }); continue; }
    const { data: blob, error } = await admin.storage.from(im.storage_bucket || SOURCE_BUCKET).download(im.storage_path);
    if (error || !blob) { cands.push({ id: im.id, b64: null }); continue; }
    cands.push({ id: im.id, b64: toBase64(new Uint8Array(await blob.arrayBuffer())) });
  }

  // --- Classification par lots (un appel par lot) ---
  const results = new Map<string, { kind: string; score: number }>();
  for (let start = 0; start < cands.length; start += MAX_IMAGES_PER_CALL) {
    const chunk = cands.slice(start, start + MAX_IMAGES_PER_CALL);
    const usable = chunk.filter((c) => c.b64);
    if (usable.length === 0) continue;

    const content: Array<Record<string, unknown>> = [];
    usable.forEach((c, j) => {
      content.push({ type: 'text', text: `Image ${j}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.b64 } });
    });
    content.push({ type: 'text', text: 'Classe chaque image ci-dessus. Réponds UNIQUEMENT avec le JSON demandé.' });

    const res = await callAnthropic({
      apiKey: anthropicKey,
      model: getAnthropicModelFast(),
      system: QUALIFY_SYSTEM,
      userMessage: '',
      content,
      maxTokens: 1500,
      caller: 'novelty-images-qualify',
    });

    const parsed = res.ok && res.text ? tryParseJson(res.text) : null;
    const arr = parsed && Array.isArray(parsed.images) ? parsed.images : [];
    for (const entry of arr) {
      const idx = Number(entry?.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= usable.length) continue;
      const kind = ALLOWED_KINDS.has(entry?.kind) ? entry.kind : 'unknown';
      let score = Number(entry?.score);
      if (!Number.isFinite(score)) score = 0;
      score = Math.max(0, Math.min(100, Math.round(score)));
      results.set(usable[idx].id, { kind, score });
    }
  }

  // --- Écriture kind + score ; défaut prudent si le modèle a manqué une image ---
  for (const im of images) {
    const r = results.get(im.id) ?? { kind: 'unknown', score: 0 };
    await admin.from('novelty_source_images')
      .update({ kind: r.kind, score: r.score })
      .eq('id', im.id);
  }

  // --- Sélection suggérée : top-3 des types hero-compatibles, par score ---
  const ranked = images
    .map((im) => ({ id: im.id, ...(results.get(im.id) ?? { kind: 'unknown', score: 0 }) }))
    .filter((x) => HERO_KINDS.has(x.kind))
    .sort((a, b) => b.score - a.score);
  const chosen = ranked.slice(0, SELECT_CAP).map((x) => x.id);
  const chosenSet = new Set(chosen);

  for (const im of images) {
    await admin.from('novelty_source_images')
      .update({ selected: chosenSet.has(im.id) })
      .eq('id', im.id);
  }

  const kindCounts: Record<string, number> = {};
  for (const im of images) {
    const k = (results.get(im.id)?.kind) ?? 'unknown';
    kindCounts[k] = (kindCounts[k] ?? 0) + 1;
  }

  return jsonResp({
    document_id,
    qualified: images.length,
    selected: chosen.length,
    kinds: kindCounts,
  });
});
