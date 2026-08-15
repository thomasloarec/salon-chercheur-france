// sync-hubspot-cron : rafraichissement automatique des connexions HubSpot.
// Appele par pg_cron avec Authorization: Bearer <SERVICE_ROLE_KEY> (repli admin possible).
// Itere sur toutes les connexions HubSpot actives et resynchronise chacune, sans JWT
// utilisateur (user_id lu directement sur la connexion). Chaque passage cree un nouvel
// import HubSpot (snapshot courant) puis supprime les anciens imports HubSpot du meme
// utilisateur (cascade -> entreprises + matches). Les imports CSV ne sont pas touches.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let m = 0; for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i); return m === 0;
}

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
  const key = await aesKey(); const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const ct = new Uint8Array(ctBuf); const comb = new Uint8Array(iv.length + ct.length); comb.set(iv, 0); comb.set(ct, iv.length);
  return btoa(String.fromCharCode(...comb));
}
async function decryptToken(b64: string): Promise<string> {
  const key = await aesKey(); const comb = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = comb.slice(0, 12); const ct = comb.slice(12);
  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(ptBuf);
}

async function syncOneConnection(admin: any, conn: any) {
  let accessToken = await decryptToken(conn.access_token_enc);
  const needRefresh = !conn.expires_at || new Date(conn.expires_at).getTime() <= Date.now() + 60000;
  if (needRefresh && conn.refresh_token_enc) {
    const rt = await decryptToken(conn.refresh_token_enc);
    const r = await fetch('https://api.hubapi.com/oauth/v1/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: Deno.env.get('HUBSPOT_CLIENT_ID') || '', client_secret: Deno.env.get('HUBSPOT_CLIENT_SECRET') || '', refresh_token: rt }) });
    const t = await r.json();
    if (r.ok && t.access_token) {
      accessToken = t.access_token;
      await admin.from('crm_connections').update({ access_token_enc: await encryptToken(t.access_token), refresh_token_enc: t.refresh_token ? await encryptToken(t.refresh_token) : conn.refresh_token_enc, expires_at: new Date(Date.now() + (Number(t.expires_in) || 1800) * 1000).toISOString() }).eq('id', conn.id);
    } else {
      throw new Error('refresh_failed: ' + JSON.stringify(t).slice(0, 150));
    }
  }

  const { data: canImport } = await admin.rpc('can_radar_import', { p_user_id: conn.user_id });
  if (canImport === false) return { success: false, skipped: 'no_access' };

  const { data: imp, error: impErr } = await admin.from('crm_imports').insert({ user_id: conn.user_id, source_type: 'hubspot', file_name: 'HubSpot (auto)', status: 'processing', total_rows: 0 }).select('id').single();
  if (impErr || !imp) throw new Error('import_create: ' + (impErr?.message || ''));
  const importId = imp.id as string;

  try {
    const rows: any[] = []; let after: string | undefined = undefined; let pages = 0;
    do {
      const url = new URL('https://api.hubapi.com/crm/v3/objects/companies');
      url.searchParams.set('limit', '100');
      url.searchParams.set('properties', 'name,domain,website');
      if (after) url.searchParams.set('after', after);
      const resp = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + accessToken } });
      if (!resp.ok) { const txt = await resp.text(); throw new Error('HubSpot API ' + resp.status + ': ' + txt.slice(0, 150)); }
      const data = await resp.json();
      for (const rr of (data.results || [])) {
        const name = rr?.properties?.name; if (!name) continue;
        const web = rr?.properties?.domain || rr?.properties?.website || null;
        rows.push({ user_id: conn.user_id, import_id: importId, company_name: String(name).slice(0, 500), website_raw: web ? String(web).slice(0, 500) : null, crm_status: null });
      }
      after = data?.paging?.next?.after; pages++;
    } while (after && pages < 40 && rows.length < 3500);

    if (rows.length === 0) {
      // Portail vide (ou reponse transitoire) : on supprime l'import vide et on garde le snapshot precedent.
      await admin.from('crm_imports').delete().eq('id', importId);
      return { success: true, companies: 0, note: 'empty_kept_previous' };
    }

    const nowIso = new Date().toISOString();
    const byDom = new Map<string, any>(); const noDom: any[] = [];
    for (const row of rows) { const dom = normalizeDomainLocal(row.website_raw); const e = { ...row, updated_at: nowIso }; if (!dom) noDom.push(e); else byDom.set(dom, e); }
    const toWrite = [...byDom.values(), ...noDom];

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

    const { data: matchData, error: matchErr } = await admin.rpc('crm_run_matching', { p_import_id: importId, p_user_id: conn.user_id });
    if (matchErr) throw new Error('Matching: ' + matchErr.message);
    const stats = (matchData || {}) as Record<string, number>;

    await admin.from('crm_imports').update({ status: 'completed', total_rows: toWrite.length, matched_companies_count: stats.matchedCompaniesCount ?? 0, unmatched_companies_count: stats.unmatchedCompaniesCount ?? 0 }).eq('id', importId);

    // Nettoyage : ne garder que ce nouvel import HubSpot (les anciens + entreprises + matches partent en cascade). Imports CSV intouches.
    await admin.from('crm_imports').delete().eq('user_id', conn.user_id).eq('source_type', 'hubspot').neq('id', importId);

    return { success: true, companies: toWrite.length, matched: stats.matchedCompaniesCount ?? 0, unmatched: stats.unmatchedCompaniesCount ?? 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from('crm_imports').update({ status: 'failed', error_message: msg.slice(0, 1000) }).eq('id', importId);
    throw e;
  }
}

async function authorize(req: Request, admin: any, url: string): Promise<{ ok: boolean; status?: number; mode?: string }> {
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return { ok: false, status: 401 };
  const token = authHeader.slice(7).trim();
  if (!token) return { ok: false, status: 401 };
  if (timingSafeEqual(token, SERVICE)) return { ok: true, mode: 'service_role' };
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!anon) return { ok: false, status: 401 };
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: ud, error: ue } = await userClient.auth.getUser(token);
  if (ue || !ud?.user) return { ok: false, status: 401 };
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: ud.user.id, _role: 'admin' });
  if (isAdmin !== true) return { ok: false, status: 403 };
  return { ok: true, mode: 'admin' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResp({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE) return jsonResp({ error: 'server_misconfigured' }, 500);
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

  const auth = await authorize(req, admin, SUPABASE_URL);
  if (!auth.ok) return jsonResp({ error: 'unauthorized' }, auth.status || 401);

  let maxConnections = 100;
  try { const b = await req.json(); if (b && Number(b.maxConnections) > 0) maxConnections = Math.min(Number(b.maxConnections), 500); } catch (_e) { /* pas de body */ }

  const { data: conns, error: connErr } = await admin.from('crm_connections').select('*').eq('provider', 'hubspot').eq('status', 'active').limit(maxConnections);
  if (connErr) return jsonResp({ success: false, stage: 'list', message: connErr.message }, 500);

  const results: any[] = [];
  for (const conn of (conns || [])) {
    try {
      const r = await syncOneConnection(admin, conn);
      results.push({ user_id: conn.user_id, portal_id: conn.portal_id, ...r });
    } catch (e) {
      results.push({ user_id: conn.user_id, portal_id: conn.portal_id, success: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return jsonResp({ success: true, connections: (conns || []).length, results });
});
