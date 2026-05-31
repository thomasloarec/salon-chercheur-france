/**
 * Phase 4A-C — Upload du logo public d'un exposant vers le bucket
 * `exhibitor-logos`. Le chemin est STABLE :
 *
 *   exhibitors/{exhibitor_id}/logo.{ext}
 *
 * Avantages :
 *  - un nouvel upload avec la même extension remplace naturellement le
 *    fichier (upsert) → pas de suppression explicite, pas d'accumulation ;
 *  - le chemin reste dans le dossier de l'exposant, conforme aux policies
 *    Storage (extract_exhibitor_id_from_logo_path attend
 *    `exhibitors/{exhibitor_id}/{filename}`).
 *
 * Dette technique documentée : si l'extension change (ex. .jpg → .png),
 * l'ancien fichier peut rester orphelin. Acceptable en V1, pas de
 * nettoyage automatique dans cette phase.
 */
import { supabase } from '@/integrations/supabase/client';

export const LOGO_BUCKET = 'exhibitor-logos';
export const LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo

/** Types MIME acceptés (SVG explicitement refusé). */
export const LOGO_ACCEPTED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const LOGO_ACCEPT_ATTR = 'image/jpeg,image/png,image/webp';

export interface LogoValidationResult {
  ok: boolean;
  error?: string;
}

/** Validation locale d'un fichier logo avant tout upload. */
export function validateLogoFile(file: File): LogoValidationResult {
  const ext = LOGO_ACCEPTED_MIME[file.type];
  if (!ext) {
    return {
      ok: false,
      error: 'Format non supporté. Utilisez un fichier JPEG, PNG ou WebP.',
    };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: 'Le fichier dépasse la taille maximale de 5 Mo.' };
  }
  return { ok: true };
}

/**
 * Téléverse le logo vers `exhibitors/{exhibitor_id}/logo.{ext}` et renvoie
 * l'URL publique. Lève une erreur lisible en cas d'échec Storage.
 */
export async function uploadExhibitorLogo(
  exhibitorId: string,
  file: File,
): Promise<string> {
  const ext = LOGO_ACCEPTED_MIME[file.type];
  if (!ext) {
    throw new Error('Format non supporté. Utilisez un fichier JPEG, PNG ou WebP.');
  }

  const path = `exhibitors/${exhibitorId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw new Error("Échec du téléversement du logo. Réessayez dans un instant.");
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Impossible de récupérer l'URL du logo téléversé.");
  }
  // Cache-buster : force le rafraîchissement de l'aperçu après remplacement.
  return `${data.publicUrl}?v=${Date.now()}`;
}