/** Types audio essayés dans l'ordre (iPhone : audio/mp4). */
export const AUDIO_MIME_PRIORITY = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'] as const;

/** Premier type pris en charge, ou null. Fonction pure : reçoit isTypeSupported. */
export function pickAudioMime(isTypeSupported: (t: string) => boolean): string | null {
  for (const t of AUDIO_MIME_PRIORITY) {
    try {
      if (isTypeSupported(t)) return t;
    } catch {
      /* type suivant */
    }
  }
  return null;
}

/** Type sans paramètres de codec. */
export const baseMime = (t: string) => (t || '').split(';')[0].trim().toLowerCase();
