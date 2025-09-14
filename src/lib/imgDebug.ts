export const IMG_DEBUG = true; // remettre à false à la fin

export function imgDebug(label: string, payload: any) {
  if (!IMG_DEBUG) return;
  // Évite les erreurs SSR
  try { console.debug(`[IMG] ${label}`, payload); } catch {}
}