import React from 'react';
import { cn } from '@/lib/utils';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import NoveltyPublishSteps from '@/components/novelty/NoveltyPublishSteps';
import DarkTexturePanel from '@/components/event/DarkTexturePanel';
import type { Event } from '@/types/event';

interface NoveltyExampleEmptyStateProps {
  event: Event;
  exhibitorCount?: number;
  className?: string;
}

/**
 * Lot 12 — bloc d'incitation à publier, période ouverte, aucune nouveauté.
 *
 * Six éléments et rien d'autre : eyebrow, titre court, phrase de preuve
 * sociale, schéma en trois étapes, CTA unique, ligne de réassurance.
 * La carte exemple, le paragraphe explicatif et le lien secondaire ont été
 * retirés : ils diluaient les deux seuls leviers du bloc (rareté et coût
 * d'entrée quasi nul).
 *
 * Contraste : blanc pur pour le texte principal, blanc à 75 % pour le
 * secondaire. Aucun bleu clair sur navy.
 */
export default function NoveltyExampleEmptyState({
  event,
  exhibitorCount,
  className,
}: NoveltyExampleEmptyStateProps) {
  const count =
    typeof exhibitorCount === 'number' && Number.isFinite(exhibitorCount)
      ? exhibitorCount
      : 0;

  const proof =
    count > 1
      ? `${count} exposants sont déjà listés sur ce salon. Aucun n’a encore publié.`
      : count === 1
        ? '1 exposant est déjà listé sur ce salon. Il n’a encore rien publié.'
        : 'Les visiteurs qui consultent cette page préparent déjà leur venue.';

  return (
    <DarkTexturePanel className={cn('w-full', className)}>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6 px-6 py-12 sm:px-10 sm:py-14">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-inverse/70">
          Espace exposants
        </span>

        <h2 className="heading-display text-2xl leading-tight text-inverse sm:text-3xl">
          La première nouveauté reste à publier
        </h2>

        <p className="text-base font-medium leading-snug text-inverse sm:text-lg">{proof}</p>

        <NoveltyPublishSteps className="mt-1" />

        <AddNoveltyButton event={event} label="Publier ma nouveauté" size="lg" />

        <p className="text-xs text-inverse/75">
          3 minutes · Gratuit · Visible avant l'ouverture
        </p>
      </div>
    </DarkTexturePanel>
  );
}
