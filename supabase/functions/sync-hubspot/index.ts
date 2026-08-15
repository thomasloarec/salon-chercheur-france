// sync-hubspot : synchronise les entreprises HubSpot de l'utilisateur vers crm_companies,
// puis declenche le matching Radar. Miroir du pipeline crm-import (source = 'hubspot').
// Autonome. Appelee par le front avec la session de l'utilisateur (JWT).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED = ['https://lotexpo.com','https://www.lotexpo.com','https://lotexpo.fr','https://lotexpo.lovable.app','http://localhost:5173','http://localhost:3000','http://localhost:8080'];
function cors(req: Request) {
  const o = req.headers.get('Origin') || '';
  const a = ALLOWED.includes(o) ? o : 'https://lotexpo.com';
  return { 'Access-Control-Allow-Origin': a, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

// Normalisation de domaine (sans regex, proche de la fonction SQL, pour la dedup avant upsert)
function normalizeDomainLocal(input: unknown): string | null {
  let s = String(input ?? '').trim().toLowerCase();
  const si = s.indexOf('://'); if (si >= 0) s = s.slice(si + 3);
  if (s.startsWith('www')) { let a = s.slice(3); if (a.length && a[0] >= '0' && a[0] <= '9') a = a.slice(1); if (a.startsWith('.')) s = a.slice(1); }
  for (const ch of ['/', '?', '#']) { const i = s.indexOf(ch); if (i >= 0) s = s.slice(0, i); }
  const ci = s.indexOf(':'); if (ci >= 0) s = s.slice(0, ci);
  if (s.endsWith('.')) s = s.slice(0, -1);
  return s.length > 0 ? s : null;
}

async function aesKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get('CRM_ENCRYPTION_KEY') || '';
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('CRM_ENCRYPTION_KEY_INVALID');
  return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptToken(plain: string): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const ct = new Uint8Array(ctBuf);
  const comb = new Uint8Array(iv.length + ct.length); comb.set(iv, 0); comb.set(ct, iv.length);
  return btoa(String.fromCharCode(...comb));
}
async function decryptToken(b64: string): Promise<string> {
  const key = await aesKey();
  const comb = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = comb.slice(0, 12); const ct = comb.slice(12);
  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(ptBuf);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

  // Auth : recuperer l'utilisateur depuis son JWT
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(req, { success: false, stage: 'auth', message: 'Non authentifie' }, 401);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return json(req, { success: false, stage: 'auth', message: 'Session invalide' }, 401);

  // Connexion HubSpot active
  const { data: conn, error: connErr } = await admin.from('crm_connections').select('*').eq('user_id', user.id).eq('provider', 'hubspot').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (connErr) return json(req, { success: false, stage: 'connection', message: connErr.message }, 500);
  if (!conn) return json(req, { success: false, stage: 'connection', message: 'Aucune connexion HubSpot active' }, 400);

  // Token : dechiffrer, rafraichir si expire
  let accessToken: string;
  try { accessToken = await decryptToken(conn.access_token_enc); }
  catch (e) { return json(req, { success: false, stage: 'decrypt', message: String(e) }, 500); }

  const needRefresh = !conn.expires_at || new Date(conn.expires_at).getTime() <= Date.now() + 60000;
  if (needRefresh && conn.refresh_token_enc) {
    try {
      const rt = await decryptToken(conn.refresh_token_enc);
      const r = await fetch('https://api.hubapi.com/oauth/v1/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: Deno.env.get('HUBSPOT_CLIENT_ID') || '', client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET') || '', refresh_token: rt }) });
      const t = await r.json();
      if (r.ok && t.access_token) {
        accessToken = t.access_token;
        await admin.from('crm_connections').update({ access_token_enc: await encryptToken(t.access_token), refresh_token_enc: t.refresh_token ? await encryptToken(t.refresh_token) : conn.refresh_token_enc, expires_at: new Date(Date.now() + (Number(t.expires_in) || 1800) * 1000).toISOString() }).eq('id', conn.id);
      }
    } catch (_e) { /* on tente avec le token courant */ }
  }

  // Meme gate d'import que le CSV (autorise le 1er usage, sinon acces valide requis)
  const { data: canImport } = await admin.rpc('can_radar_import', { p_user_id: user.id });
  if (canImport === false) return json(req, { success: false, stage: 'access', message: 'Acces Radar requis' }, 403);

  // Creer l'import
  const { data: imp, error: impErr } = await admin.from('crm_imports').insert({ user_id: user.id, source_type: 'hubspot', file_name: 'HubSpot (portail ' + (conn.portal_id ?? '') + ')', status: 'processing', total_rows: 0 }).select('id').single();
  if (impErr || !imp) return json(req, { success: false, stage: 'import_create', message: impErr?.message }, 500);
  const importId = imp.id as string;

  try {
    // Tirer les entreprises HubSpot (paginees, lecture seule)
    const rows: any[] = []; let after: string | undefined = undefined; let pages = 0;
    do {
      const url = new URL('https://api.hubapi.com/crm/v3/objects/companies');
      url.searchParams.set('limit', '100');
      url.searchParams.set('properties', 'name,domain,website');
      if (after) url.searchParams.set('after', after);
      const resp = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + accessToken } });
      if (!resp.ok) { const txt = await resp.text(); throw new Error('HubSpot API ' + resp.status + ': ' + txt.slice(0, 200)); }
      const data = await resp.json();
      for (const r of (data.results || [])) {
        const name = r?.properties?.name; if (!name) continue;
        const web = r?.properties?.domain || r?.properties?.website || null;
        rows.push({ user_id: user.id, import_id: importId, company_name: String(name).slice(0, 500), website_raw: web ? String(web).slice(0, 500) : null, crm_status: null });
      }
      after = data?.paging?.next?.after; pages++;
    } while (after && pages < 40 && rows.length < 3500);

    if (rows.length === 0) {
      await admin.from('crm_imports').update({ status: 'completed', total_rows: 0, matched_companies_count: 0, unmatched_companies_count: 0 }).eq('id', importId);
      return json(req, { success: true, importId, companies: 0, matched: 0, unmatched: 0, portal_id: conn.portal_id, message: 'Aucune entreprise dans ce portail HubSpot' });
    }

    // Dedup par domaine normalise (evite les conflits d'upsert)
    const nowIso = new Date().toISOString();
    const byDom = new Map<string, any>(); const noDom: any[] = [];
    for (const row of rows) { const dom = normalizeDomainLocal(row.website_raw); const e = { ...row, updated_at: nowIso }; if (!dom) noDom.push(e); else byDom.set(dom, e); }
    const toWrite = [...byDom.values(), ...noDom];

    // Upsert par lots (fallback insert si pas de contrainte unique)
    const BATCH = 500;
    for (let i = 0; i < toWrite.length; i += BATCH) {
      const slice = toWrite.slice(i, i + BATCH);
      const { error: upErr } = await admin.from('crm_companies').upsert(slice, { onConflict: 'user_id,normalized_domain', ignoreDuplicates: false });
      if (upErr) {
        const noC = upErr.code === '42P10' || /no unique or exclusion constraint/i.test(upErr.message || '');
        if (noC) { const { error: insErr } = await admin.from('crm_companies').insert(slice); if (insErr) throw new Error('Insert: ' + insErr.message); }
        else throw new Error('Upsert: ' + upErr.message);
      }
    }

    // Matching Radar existant
    const { data: matchData, error: matchErr } = await admin.rpc('crm_run_matching', { p_import_id: importId, p_user_id: user.id });
    if (matchErr) throw new Error('Matching: ' + matchErr.message);
    const stats = (matchData || {}) as Record<string, number>;

    await admin.from('crm_imports').update({ status: 'completed', total_rows: toWrite.length, matched_companies_count: stats.matchedCompaniesCount ?? 0, unmatched_companies_count: stats.unmatchedCompaniesCount ?? 0 }).eq('id', importId);

    return json(req, { success: true, importId, companies: toWrite.length, matched: stats.matchedCompaniesCount ?? 0, unmatched: stats.unmatchedCompaniesCount ?? 0, portal_id: conn.portal_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from('crm_imports').update({ status: 'failed', error_message: msg.slice(0, 1000) }).eq('id', importId);
    return json(req, { success: false, stage: 'sync', message: msg }, 500);
  }
});
