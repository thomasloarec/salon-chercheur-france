import type { StartMode } from './goal';

export const CAMERA_PENDING = 'lotexpo-leads:camera-pending';

/**
 * Tuile « Carte » : note la prise de vue en cours puis ouvre l'appareil photo
 * dans le même toucher (aucune attente avant click, sinon l'iPhone bloque).
 */
export function openCardCamera(
  input: { click: () => void } | null,
  workspaceId: string,
  storage: { setItem: (k: string, v: string) => void } | null,
  now = Date.now(),
): boolean {
  if (!input) return false;
  try {
    storage?.setItem(CAMERA_PENDING, JSON.stringify({ workspaceId, kind: 'card', at: now }));
  } catch {
    /* ignoré */
  }
  input.click();
  return true;
}

/** État initial de l'étape « Qui ? » selon le mode d'ouverture. */
export function initialWho(o: { startMode: StartMode | null; hasPhoto: boolean; voiceOk: boolean }) {
  return {
    dictateOnly: o.startMode === 'dictate' && o.voiceOk,
    scanning: o.startMode === 'badge',
    readPhoto: o.startMode === 'card' && o.hasPhoto,
    kindPicker: false,
    nameAutoFocus: o.startMode !== 'dictate',
  };
}
