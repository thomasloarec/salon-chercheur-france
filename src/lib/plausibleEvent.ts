/**
 * Envoi d'un événement personnalisé à Plausible (sans cookie, déjà chargé dans index.html).
 * Silencieux si le script est bloqué ou absent : la mesure ne doit jamais casser l'interface.
 * Pour voir un événement dans Plausible, créer un objectif « Custom event » du même nom.
 */
export function plausibleEvent(name: string, props?: Record<string, string>): void {
  try {
    const fn = (window as unknown as { plausible?: (n: string, o?: { props?: Record<string, string> }) => void })
      .plausible;
    if (typeof fn === 'function') fn(name, props ? { props } : undefined);
  } catch {
    // mesure best effort
  }
}
