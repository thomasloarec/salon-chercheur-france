import type { ReactNode } from 'react';

/**
 * Conteneur centré des écrans du mode salon.
 * Sous 768 px : simple colonne flexible, aucun changement visuel.
 * md : largeur max 3xl et marges px-6 ; lg : largeur max 6xl et marges px-8.
 */
export const SCREEN_WIDTH = 'md:mx-auto md:w-full md:max-w-3xl lg:max-w-6xl';

export default function ScreenContainer({ children }: { children: ReactNode }) {
  return <div className={`flex flex-1 flex-col ${SCREEN_WIDTH} md:px-6 lg:px-8`}>{children}</div>;
}
