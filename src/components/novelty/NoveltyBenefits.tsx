import React from 'react';
import { Eye, MessageSquare, Users } from 'lucide-react';

/**
 * Trois bénéfices exposant, en remplacement du schéma de processus.
 * Formulations alignées sur la page /exposants : visibilité en amont,
 * contacts qualifiés avant l'ouverture, et lecteurs qui sont les visiteurs
 * à venir du salon.
 */
const BENEFITS = [
  {
    icon: Eye,
    title: 'Être vu avant l\u2019ouverture',
    text: 'Votre nouveauté apparaît sur cette page au moment où les visiteurs construisent leur parcours, pas seulement quand ils passent devant votre stand.',
  },
  {
    icon: MessageSquare,
    title: 'Récupérer des contacts en amont',
    text: 'Les visiteurs intéressés téléchargent votre brochure ou demandent un rendez-vous. Vous obtenez leurs coordonnées avant le salon, pas après.',
  },
  {
    icon: Users,
    title: 'Ceux qui vous lisent seront au salon',
    text: 'Votre nouveauté s\u2019affiche sur la page de ce salon. Les personnes qui la consultent préparent leur visite : elles peuvent décider de passer vous voir.',
  },
] as const;

export const NoveltyBenefits: React.FC<{ className?: string }> = ({ className }) => (
  <ul className={`grid w-full gap-5 sm:grid-cols-3 sm:gap-6 ${className ?? ''}`}>
    {BENEFITS.map((b) => (
      <li key={b.title} className="flex min-w-0 flex-col gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-inverse-primary/40 bg-inverse-primary/15">
          <b.icon className="h-5 w-5 text-inverse-primary" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold leading-snug text-inverse">{b.title}</span>
        <span className="text-xs leading-relaxed text-inverse/75 sm:text-sm">{b.text}</span>
      </li>
    ))}
  </ul>
);

export default NoveltyBenefits;
