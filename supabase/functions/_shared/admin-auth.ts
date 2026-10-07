// _shared/admin-auth.ts
//
// Garde d'accès commune aux fonctions de diagnostic (correctif sécurité, 07/10/2026).
// Accès accordé uniquement :
//   - à la clé service_role (automatisations serveur, n8n, cron),
//   - à un JWT utilisateur dont le compte porte le rôle admin dans user_roles
//     (même source de vérité que la fonction SQL is_admin()).
// Même logique que airtable-write (corrigée le 13/09/2026).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/** Retourne null si autorisé, sinon une Response d'erreur. */
export async function requireAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
  label = 'admin-auth',
): Promise<Response | null> {
  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return deny(401, 'unauthorized');
  const token = authHeader.slice('Bearer '.length).trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return deny(500, 'server_misconfigured');

  if (token === serviceKey) return null;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    console.warn(`[${label}] refus : JWT invalide`);
    return deny(401, 'unauthorized');
  }

  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!role) {
    console.warn(`[${label}] refus : utilisateur non admin`, userData.user.id);
    return deny(403, 'forbidden');
  }
  return null;
}
