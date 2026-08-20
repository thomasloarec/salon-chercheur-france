import React from 'react';
import { PenLine, LayoutGrid, MessagesSquare } from 'lucide-react';

/**
 * Lot 12 — schéma horizontal en trois étapes du bloc d'incitation.
 * Remplace l'ancienne carte exemple : trois icônes reliées par un filet fin,
 * un libellé court sous chacune, aucun paragraphe.
 *
 * Les étapes décrivent le parcours réel de l'exposant, du geste au bénéfice.
 */
const STEPS = [
  { icon: PenLine, label: 'Publier en 3 minutes' },
  { icon: LayoutGrid, label: 'Apparaître sur cette page' },
  { icon: MessagesSquare, label: 'Être contacté par les visiteurs' },
] as const;

export const NoveltyPublishSteps: React.FC<{ className?: string }> = ({ className }) => (
  <ol
    className={`flex w-full max-w-2xl items-start justify-between gap-2 sm:gap-4 ${className ?? ''}`}
  >
    {STEPS.map((step, i) => (
      <React.Fragment key={step.label}>
        <li className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-inverse-primary/40 bg-inverse-primary/15">
            <step.icon className="h-5 w-5 text-inverse-primary" aria-hidden="true" />
          </span>
          <span className="text-xs font-medium leading-snug text-inverse/80 sm:text-sm">
            {step.label}
          </span>
        </li>
        {i < STEPS.length - 1 && (
          <span
            aria-hidden="true"
            className="mt-[22px] h-px w-4 flex-none bg-inverse/25 sm:w-10"
          />
        )}
      </React.Fragment>
    ))}
  </ol>
);

export default NoveltyPublishSteps;
