import { useReducedMotion, type Transition, type Variants } from 'framer-motion';

export const SPRING: Transition = { type: 'spring', stiffness: 200, damping: 25 };

/** Entrée d'écran : glissement de 24 px vers le haut et fondu, 220 ms. */
export const screenEnter: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.15 } },
};

/** Pression : échelle 0,97 puis retour en ressort. */
export const press = {
  whileTap: { scale: 0.97 },
  transition: { type: 'spring', stiffness: 500, damping: 25 } as Transition,
};

/** Apparition : échelle 0,9 vers 1 en ressort. */
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } },
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Vibre seulement si l'appareil le permet et si le mouvement n'est pas réduit. */
export function haptic(pattern: number | number[] = 10): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* sans effet */
  }
}

/** Vrai quand l'utilisateur demande moins de mouvement. */
export function useCalmMotion(): boolean {
  return useReducedMotion() ?? false;
}
