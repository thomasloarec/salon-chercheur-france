import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EventAiBannerProps {
  /** Piloté par capabilities.canPrepareVisit — jamais de seuil en dur ici. */
  canPrepareVisit: boolean;
  onPrepareVisit: () => void;
}

/**
 * Lot 7 — Bandeau navy « Ne visitez plus un salon au hasard ».
 * Respiration forte entre la zone vivante (exposants) et la zone statique
 * (carousel d'informations). Masqué quand le Parcours IA n'est pas disponible :
 * pas de bandeau sombre sans action.
 */
export default function EventAiBanner({ canPrepareVisit, onPrepareVisit }: EventAiBannerProps) {
  if (!canPrepareVisit) return null;

  return (
    <div
      aria-label="Préparer votre visite avec l'IA Lotexpo"
      role="region"
      className="w-full"
    >
      {/* Lot 11 — plus de carte : le registre sombre texturé est porté par la
          bande pleine largeur parente (EventBand tone="dark-texture"). */}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <h2 className="heading-display text-2xl leading-tight text-inverse sm:text-4xl">
          Ne visitez plus un salon au hasard
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-inverse-muted sm:text-base">
          Lotexpo analyse les exposants et aide à identifier ceux qui correspondent
          aux objectifs du visiteur.
        </p>
        <Button size="lg" onClick={onPrepareVisit} className="gap-2">
          Préparer ma visite avec l'IA
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
