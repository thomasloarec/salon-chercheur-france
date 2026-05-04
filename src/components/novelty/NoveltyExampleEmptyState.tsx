import React from 'react';
import { Building2, Clock, Sparkles, Clock3, Gift, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import AddNoveltyButton from '@/components/novelty/AddNoveltyButton';
import type { Event } from '@/types/event';

interface NoveltyExampleEmptyStateProps {
  event: Event;
  className?: string;
}

/**
 * Empty state pédagogique et orienté conversion.
 * Affiche une carte d'exemple visuellement identique à une vraie nouveauté,
 * mais clairement identifiée comme "Exemple" pour ne pas tromper l'utilisateur.
 * Aucune donnée n'est écrite en base.
 */
export default function NoveltyExampleEmptyState({
  event,
  className,
}: NoveltyExampleEmptyStateProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-xl font-semibold">
          Aucune nouveauté publiée pour le moment
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Les nouveautés permettent aux exposants de présenter en amont ce
          qu'ils vont montrer sur leur stand : innovation, démonstration,
          produit phare, lancement ou animation.
        </p>
      </div>

      {/* Carte exemple — reprend le design de NoveltyEventCard */}
      <div className="relative">
        <Card
          aria-hidden="true"
          className="group overflow-hidden border-dashed border-primary/40 bg-card/60"
        >
          <div className="flex flex-col sm:flex-row">
            {/* Visuel */}
            <div className="relative shrink-0 bg-muted overflow-hidden w-full sm:w-44 md:w-48 aspect-[4/3] sm:aspect-[4/5]">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/10 to-muted/40">
                <Sparkles className="h-7 w-7 text-primary/50" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  Innovation
                </span>
              </div>
              <div className="absolute top-2 left-2">
                <Badge className="bg-primary text-primary-foreground gap-1 shadow-sm">
                  <Eye className="h-3 w-3" />
                  Exemple
                </Badge>
              </div>
            </div>

            {/* Texte */}
            <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="font-medium">
                  Innovation
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border tabular-nums bg-background text-foreground/80 border-border">
                  <Clock className="h-3 w-3" />
                  Aperçu
                </span>
              </div>

              <h3 className="font-semibold text-base sm:text-lg leading-snug">
                Présentez en avant-première ce que les visiteurs découvriront
                sur votre stand
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed">
                En quelques lignes, expliquez ce que vous exposez, ce qui le
                rend intéressant et pourquoi un visiteur devrait venir vous
                rencontrer pendant le salon.
              </p>

              <div className="h-px bg-border/60" />

              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground truncate">
                  Votre marque ici
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* CTA + réassurance */}
      <div className="flex flex-col items-start gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          Publication rapide, gratuite et visible avant l'événement.
        </p>
        <AddNoveltyButton
          event={event}
          label="Publier ma nouveauté"
          size="default"
        />
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            3 minutes
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-primary" />
            Gratuit
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-primary" />
            Visible avant l'ouverture du salon
          </li>
        </ul>
      </div>
    </section>
  );
}