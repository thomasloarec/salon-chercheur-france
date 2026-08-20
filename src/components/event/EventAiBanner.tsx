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
    <section
      aria-label="Préparer votre visite avec l'IA Lotexpo"
      className="mx-auto w-full max-w-[1280px] overflow-hidden rounded-2xl bg-surface-inverse px-6 py-10 text-background sm:px-10 sm:py-14"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <h2 className="heading-display text-2xl leading-tight text-background sm:text-4xl">
          Ne visitez plus un salon au hasard
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-background/75 sm:text-base">
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
