import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import { sendResendEmail } from '../_shared/resend.ts';

const BUCKET = 'organizer-imports';

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',').pop()! : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors instanceof Response) return cors;
  const headers = { ...buildCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST requis' }), { status: 405, headers });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Configuration serveur incomplète' }), { status: 500, headers });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authentification requise' }), { status: 401, headers });
  }
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Authentification invalide' }), { status: 401, headers });
  }

  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = String(body.action ?? '');

  if (action === 'upload') {
    const { event_id, file_base64, file_name, content_type } = body ?? {};
    if (!event_id || !file_base64 || !file_name) {
      return new Response(JSON.stringify({ error: 'event_id, file_base64 et file_name requis' }), { status: 400, headers });
    }

    const { data: event, error: evErr } = await service
      .from('events')
      .select('id, nom_event, owner_user_id')
      .eq('id', event_id)
      .maybeSingle();
    if (evErr || !event) {
      return new Response(JSON.stringify({ error: 'Salon introuvable' }), { status: 404, headers });
    }
    if (event.owner_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Accès refusé' }), { status: 403, headers });
    }

    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(String(file_base64));
    } catch {
      return new Response(JSON.stringify({ error: 'Fichier invalide' }), { status: 400, headers });
    }

    const safeName = String(file_name).replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const path = `${event_id}/${Date.now()}_${safeName}`;
    const { error: upErr } = await service.storage.from(BUCKET).upload(path, bytes, {
      contentType: content_type || 'application/octet-stream',
      upsert: false,
    });
    if (upErr) {
      console.error('[organizer-exhibitor-import] upload error', upErr);
      return new Response(JSON.stringify({ error: 'Upload échoué', details: upErr.message }), { status: 500, headers });
    }

    const { error: insErr } = await service.from('organizer_exhibitor_imports').insert({
      event_id,
      uploaded_by: user.id,
      file_path: path,
      original_name: file_name,
    });
    if (insErr) {
      console.error('[organizer-exhibitor-import] insert error', insErr);
      return new Response(JSON.stringify({ error: 'Enregistrement échoué', details: insErr.message }), { status: 500, headers });
    }

    // Notification admin
    try {
      const { data: profile } = await service
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('user_id', user.id)
        .maybeSingle();
      const displayName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
        profile?.email || user.email || 'Un organisateur';

      const subject = `Nouvelle liste d'exposants, ${event.nom_event}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <p>${displayName} a transmis une liste d'exposants pour le salon <strong>${event.nom_event}</strong>.</p>
          <p>Retrouvez le fichier dans l'administration, onglet Organisateurs, dans la fiche de ce salon.</p>
          <p style="margin-top: 24px;">
            <a href="https://lotexpo.com/admin/organisateurs"
               style="background:#ff751f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600;">
              Ouvrir l'administration
            </a>
          </p>
        </div>
      `;
      await sendResendEmail({
        to: 'admin@lotexpo.com',
        subject,
        html,
      });
    } catch (e) {
      console.error('[organizer-exhibitor-import] email admin échoué', e);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }

  if (action === 'signed_url') {
    const { file_path } = body ?? {};
    if (!file_path) {
      return new Response(JSON.stringify({ error: 'file_path requis' }), { status: 400, headers });
    }
    const { data: isAdmin, error: roleErr } = await service.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Accès admin requis' }), { status: 403, headers });
    }
    const { data: signed, error: sErr } = await service.storage
      .from(BUCKET)
      .createSignedUrl(String(file_path), 300);
    if (sErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: 'URL signée impossible', details: sErr?.message }), { status: 500, headers });
    }
    return new Response(JSON.stringify({ url: signed.signedUrl }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: 'action invalide' }), { status: 400, headers });
});