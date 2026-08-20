import { useState } from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/event';

interface EventLongDescriptionProps {
  event: Event;
}

/**
 * Bloc de transition temporaire (lot 2) : la description longue sortie du Hero.
 * Le lot 7 la déplacera dans le carousel « À propos de l'événement ».
 * Logique reprise à l'identique : priorité description_enrichie si
 * enrichissement_statut === 'valide', sanitization DOMPurify, « Voir plus »
 * purement visuel (le HTML complet reste dans le DOM, donc crawlable).
 */
export default function EventLongDescription({ event }: EventLongDescriptionProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  const sanitize = (dirtyHtml: string) =>
    DOMPurify.sanitize(dirtyHtml, { ADD_TAGS: ['mark'], FORBID_ATTR: ['style'] });

  const secteurText = Array.isArray(event.secteur)
    ? event.secteur.join(', ').toLowerCase()
    : (event.secteur?.toLowerCase() || '');
  const defaultDescription = `Découvrez ${event.nom_event}, un événement incontournable du secteur ${secteurText}. 
    Retrouvez les dernières innovations, rencontrez les professionnels du secteur et développez votre réseau.`;

  const isEnriched = event.enrichissement_statut === 'valide' && !!event.description_enrichie;
  const rawDescription = isEnriched
    ? event.description_enrichie!
    : (event.description_event || defaultDescription);

  const description = isEnriched
    ? rawDescription
        .split(/\n\n+/)
        .filter((p) => p.trim())
        .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('')
    : rawDescription;

  return (
    <section
      aria-label={`À propos de ${event.nom_event}`}
      className="mx-auto w-full max-w-[1280px] rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div
        className={cn(
          'prose prose-sm max-w-none text-left leading-relaxed text-muted-foreground [&>p]:mb-3 [&_*]:text-left',
          !showFullDescription && 'line-clamp-3',
        )}
        dangerouslySetInnerHTML={{ __html: sanitize(description) }}
      />
      <Button
        variant="link"
        size="sm"
        className="mt-1 h-auto p-0 text-primary"
        onClick={() => setShowFullDescription(!showFullDescription)}
      >
        {showFullDescription ? 'Voir moins' : 'Voir plus...'}
      </Button>
    </section>
  );
}
