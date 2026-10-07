// booth-card-scan
//
// Lotexpo Leads : lecture d'une carte de visite ou d'un badge photographié sur le stand.
// Appel depuis le site avec la session de l'utilisateur (verify_jwt = true).
//
// 1. booth_card_scan_authorize, AVEC la session de l'appelant : appartenance à l'équipe,
//    formule (pas de lecture IA en formule gratuite), salon non archivé, plafond quotidien,
//    idempotence (un scan renvoyé n'est ni recompté ni relu).
// 2. Lecture de l'image par la vision Claude. La photo reste en mémoire : jamais stockée,
//    jamais journalisée.
// 3. Normalisation stricte des champs (un champ douteux devient vide, jamais inventé).
// 4. Journal du résultat avec la clé serveur (_booth_card_scan_complete) : modèle, durée,
//    jetons, champs lus. Les champs lus sont effacés au bout de 30 jours.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { ANTHROPIC_API_URL, buildAnthropicHeaders, getAnthropicModelFast } from '../_shared/anthropic.ts';

const LOG = '[booth-card-scan]';
const MAX_BASE64 = 2_000_000; // environ 1,5 Mo d'image ; le téléphone envoie environ 1 280 px
const MODEL_TIMEOUT_MS = 25_000;
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}$/i;
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.fr', 'hotmail.com', 'hotmail.fr', 'outlook.com',
  'outlook.fr', 'live.com', 'live.fr', 'msn.com', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr',
  'laposte.net', 'icloud.com', 'me.com', 'aol.com', 'gmx.fr', 'gmx.com', 'proton.me', 'protonmail.com',
  'bbox.fr', 'neuf.fr', 'numericable.fr',
]);
const FIELDS = ['first_name', 'last_name', 'company_name', 'job_title', 'email', 'phone', 'mobile', 'website', 'linkedin_url'] as const;
type Field = typeof FIELDS[number];
const MAXLEN: Record<Field, number> = {
  first_name: 80, last_name: 80, company_name: 160, job_title: 160, email: 200,
  phone: 40, mobile: 40, website: 200, linkedin_url: 300,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const ERROR_STATUS: Record<string, number> = {
  BOOTH_AUTH_REQUIRED: 401,
  BOOTH_FORBIDDEN: 403,
  BOOTH_NOT_FOUND: 404,
  BOOTH_PLAN_REQUIRED: 402,
  BOOTH_WORKSPACE_ARCHIVED: 409,
  BOOTH_RATE_LIMITED: 429,
  BOOTH_INVALID_INPUT: 400,
  BOOTH_DISABLED: 503,
};

const SYSTEM_PROMPT = `Tu lis la photo d'une carte de visite ou d'un badge de salon professionnel, prise sur un stand.
Tu renvoies UNIQUEMENT un objet JSON, sans texte autour, de la forme :
{"readable": true, "first_name": "", "last_name": "", "company_name": "", "job_title": "", "email": "", "phone": "", "mobile": "", "website": "", "linkedin_url": "", "qr_present": false, "confidence": {"first_name": "high", ...}}

Règles absolues :
- Recopie exactement ce qui est imprimé. N'invente rien, ne complète rien, ne traduis rien. Un champ absent ou illisible vaut "".
- first_name et last_name : sépare le prénom du nom. Un nom écrit en capitales (ex. « DUPONT ») est le nom de famille ; garde la casse imprimée.
- company_name : le nom de l'entreprise (logo ou texte), sans forme juridique ajoutée si elle n'est pas imprimée.
- job_title : la fonction telle qu'imprimée.
- phone : le numéro fixe principal ; mobile : le numéro portable s'il est distinct. Garde le format imprimé, indicatif compris.
- website : le site imprimé ; linkedin_url : seulement une adresse LinkedIn imprimée.
- Plusieurs personnes sur la carte : prends la plus visible.
- Badge de salon : il porte souvent seulement le nom, l'entreprise et parfois la fonction ; ignore le nom du salon, les catégories (VISITEUR, EXPOSANT, PRESSE) et les numéros de badge.
- qr_present : true si un QR code ou un code-barres est visible.
- confidence : pour chaque champ non vide, "high" si parfaitement net, "medium" si un caractère peut être douteux, "low" si tu n'es pas sûr.
- Si l'image n'est pas une carte ou un badge, ou si rien n'est lisible : {"readable": false}.`;

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normalize(raw: Record<string, unknown>) {
  const fields: Record<Field, string | null> = {} as Record<Field, string | null>;
  for (const f of FIELDS) fields[f] = clean(raw[f], MAXLEN[f]);

  if (fields.email) {
    const e = fields.email.replace(/\s/g, '').replace(/^mailto:/i, '').toLowerCase();
    fields.email = EMAIL_RE.test(e) ? e : null;
  }
  for (const p of ['phone', 'mobile'] as const) {
    const v = fields[p];
    if (v && (v.replace(/\D/g, '').length < 6 || /[a-z]{3,}/i.test(v))) fields[p] = null;
  }
  if (fields.phone && fields.mobile && fields.phone.replace(/\D/g, '') === fields.mobile.replace(/\D/g, '')) {
    fields.mobile = null;
  }
  if (fields.website) {
    let w = fields.website.replace(/\s/g, '');
    if (!/^https?:\/\//i.test(w)) w = `https://${w}`;
    try {
      const u = new URL(w);
      fields.website = u.hostname.includes('.') ? u.toString().replace(/\/$/, '') : null;
    } catch {
      fields.website = null;
    }
  }
  if (fields.linkedin_url) {
    let l = fields.linkedin_url.replace(/\s/g, '');
    if (!/linkedin\.com/i.test(l)) l = '';
    else if (!/^https?:\/\//i.test(l)) l = `https://${l}`;
    fields.linkedin_url = l || null;
  }

  const confIn = (raw.confidence && typeof raw.confidence === 'object') ? raw.confidence as Record<string, unknown> : {};
  const confidence: Partial<Record<Field, 'high' | 'medium' | 'low'>> = {};
  for (const f of FIELDS) {
    if (!fields[f]) continue;
    const c = confIn[f];
    confidence[f] = c === 'high' || c === 'medium' ? c : 'low';
  }

  let company_domain: string | null = null;
  if (fields.website) {
    try {
      company_domain = new URL(fields.website).hostname.replace(/^www\./i, '').toLowerCase();
    } catch { /* rien */ }
  }
  if (!company_domain && fields.email) {
    const d = fields.email.split('@')[1];
    if (d && !FREE_MAIL.has(d)) company_domain = d;
  }

  const hasIdentity = !!(fields.first_name || fields.last_name || fields.company_name || fields.email || fields.phone || fields.mobile);
  return { fields, confidence, company_domain, qr_present: raw.qr_present === true, hasIdentity };
}

function parseModelJson(text: string): Record<string, unknown> | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(t.slice(start, end + 1));
    return o && typeof o === 'object' ? o as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'BOOTH_AUTH_REQUIRED' }, 401);

  let body: { workspace_id?: string; scan_id?: string; kind?: string; image_base64?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }
  const workspaceId = body.workspace_id ?? '';
  const scanId = body.scan_id ?? '';
  const kind = body.kind === 'badge' ? 'badge' : 'card';
  const mediaType = (body.media_type ?? 'image/jpeg').toLowerCase();
  const image = (body.image_base64 ?? '').replace(/^data:[^,]+,/, '');
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(scanId) || !MEDIA_TYPES.has(mediaType) || !image) {
    return json({ error: 'BOOTH_INVALID_INPUT' }, 400);
  }
  if (image.length > MAX_BASE64) return json({ error: 'BOOTH_IMAGE_TOO_LARGE' }, 413);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });

  // 1. Contrôles par la base, avec l'identité réelle de l'appelant
  const { data: auth, error: authErr } = await userClient.rpc('booth_card_scan_authorize', {
    p_workspace_id: workspaceId,
    p_scan_id: scanId,
    p_kind: kind,
  });
  if (authErr) {
    // Jeton anonyme : la fonction n'est pas exécutable (permission denied) => connexion requise
    const code = Object.keys(ERROR_STATUS).find((k) => authErr.message?.includes(k))
      ?? (/permission denied/i.test(authErr.message ?? '') ? 'BOOTH_AUTH_REQUIRED' : 'BOOTH_ERROR');
    return json({ error: code }, ERROR_STATUS[code] ?? 500);
  }
  if (auth?.already_done) {
    if (auth.status === 'unreadable') return json({ scan_id: scanId, status: 'unreadable' });
    const ex = auth.extracted ?? {};
    return json({ scan_id: scanId, status: 'ok', ...ex });
  }

  const finish = async (status: 'ok' | 'unreadable' | 'error', extracted: unknown, model: string,
                        latency: number, inTok: number | null, outTok: number | null, errorCode: string | null) => {
    const { error } = await serviceClient.rpc('_booth_card_scan_complete', {
      p_scan_id: scanId, p_status: status, p_extracted: extracted, p_model: model,
      p_latency_ms: latency, p_input_tokens: inTok, p_output_tokens: outTok, p_error_code: errorCode,
    });
    if (error) console.error(`${LOG} journal impossible (${error.code ?? 'inconnu'})`);
  };

  // 2. Lecture par la vision Claude
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const model = Deno.env.get('BOOTH_CARD_MODEL') || getAnthropicModelFast();
  if (!apiKey) {
    await finish('error', null, model, 0, null, null, 'no_api_key');
    return json({ error: 'BOOTH_SCAN_FAILED' }, 502);
  }

  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MODEL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: buildAnthropicHeaders(apiKey),
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        max_tokens: 700,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: kind === 'badge' ? 'Badge de salon. Renvoie le JSON.' : 'Carte de visite. Renvoie le JSON.' },
          ],
        }],
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    const code = (e as Error)?.name === 'AbortError' ? 'timeout' : 'network_error';
    await finish('error', null, model, Date.now() - t0, null, null, code);
    return json({ error: 'BOOTH_SCAN_FAILED' }, 502);
  }
  clearTimeout(timer);
  const latency = Date.now() - t0;

  if (!res.ok) {
    console.error(`${LOG} modèle ${res.status}`);
    await finish('error', null, model, latency, null, null, `http_${res.status}`);
    return json({ error: 'BOOTH_SCAN_FAILED' }, 502);
  }

  const payload = await res.json().catch(() => null) as
    { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } } | null;
  const inTok = payload?.usage?.input_tokens ?? null;
  const outTok = payload?.usage?.output_tokens ?? null;
  const text = (payload?.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  const raw = parseModelJson(text);
  if (!raw) {
    await finish('error', null, model, latency, inTok, outTok, 'bad_json');
    return json({ error: 'BOOTH_SCAN_FAILED' }, 502);
  }

  // 3. Normalisation
  const n = raw.readable === false ? null : normalize(raw);
  if (!n || !n.hasIdentity) {
    await finish('unreadable', null, model, latency, inTok, outTok, null);
    return json({ scan_id: scanId, status: 'unreadable' });
  }

  const result = { fields: n.fields, confidence: n.confidence, company_domain: n.company_domain, qr_present: n.qr_present };
  // 4. Journal
  await finish('ok', result, model, latency, inTok, outTok, null);
  return json({ scan_id: scanId, status: 'ok', ...result });
});
