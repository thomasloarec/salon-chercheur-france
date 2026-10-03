// Demande d'un lien de connexion envoyé par Lotexpo (edge function assistant-login-link).
import { supabase } from '@/integrations/supabase/client';

/** Renvoie null en cas de succès, sinon le message d'erreur à afficher. */
export async function requestLoginLink(email: string, next: string): Promise<string | null> {
  const generic = 'Envoi impossible pour le moment. Réessayez dans un instant.';
  try {
    const { error } = await supabase.functions.invoke('assistant-login-link', { body: { email, next } });
    if (!error) return null;
    let body: any = null;
    try {
      body = await (error as any).context?.json?.();
    } catch {
      /* corps illisible */
    }
    if (body?.code === 'rate_limited') return body.error || generic;
    if (body?.code === 'invalid_email') return 'Vérifiez votre adresse email.';
    return generic;
  } catch {
    return generic;
  }
}

export function safeNextPath(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  if (!s || !s.startsWith('/') || s.startsWith('//') || s.includes('\\')) return '/agenda';
  return s;
}
