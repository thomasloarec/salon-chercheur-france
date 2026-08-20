import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, MapPin, Building, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventMapEmbed from '@/components/maps/EventMapEmbed';
import { isTarifDisplayable } from '@/lib/eventCapabilities';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/event';

interface EventInfoBlocksProps {
  event: Event;
}

const sanitize = (dirty: string) =>
  DOMPurify.sanitize(dirty, { ADD_TAGS: ['mark'], FORBID_ATTR: ['style'] });

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
      <h3 className="heading-display mb-4 text-xl text-foreground sm:text-2xl">{title}</h3>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}

/**
 * Lot 12 — zone « Tout savoir sur … ».
 * Le carousel du lot 7 est supprimé : les deux blocs sont désormais côte à
 * côte et toujours visibles (empilés sous 1024 px). Le slide « Pourquoi
 * visiter » est retiré définitivement (décision produit).
 *
 * La description longue reste entière dans le DOM (SEO) : « En savoir plus »
 * ne fait que retirer le line-clamp.
 */
export default function EventInfoBlocks({ event }: EventInfoBlocksProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  const descriptionHtml = useMemo(() => {
    const isEnriched =
      event.enrichissement_statut === 'valide' && !!event.description_enrichie;
    const raw = isEnriched ? event.description_enrichie! : event.description_event || '';
    if (!raw.trim()) return '';
    return isEnriched
      ? raw
          .split(/\n\n+/)
          .filter((p) => p.trim())
          .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
          .join('')
      : raw;
  }, [event.description_enrichie, event.description_event, event.enrichissement_statut]);

  const addressLine = [
    event.rue,
    event.code_postal && event.ville
      ? `${event.code_postal} ${event.ville}`
      : event.ville || event.code_postal,
    event.country || 'France',
  ]
    .filter(Boolean)
    .join(', ');

  const mapAddress = [event.nom_lieu, addressLine].filter(Boolean).join(', ') || null;
  const showTarif = isTarifDisplayable(event.tarif);

  const dateLabel = (() => {
    try {
      const start = format(new Date(event.date_debut), 'd MMMM yyyy', { locale: fr });
      if (!event.date_fin || event.date_fin === event.date_debut) return start;
      return `${format(new Date(event.date_debut), 'd MMM', { locale: fr })} – ${format(
        new Date(event.date_fin),
        'd MMMM yyyy',
        { locale: fr },
      )}`;
    } catch {
      return null;
    }
  })();

  return (
    <section
      aria-label={`Informations sur ${event.nom_event}`}
      className="mx-auto w-full max-w-[1280px]"
    >
      <h2 className="heading-display mb-6 text-xl text-foreground sm:text-2xl">
        Tout savoir sur {event.nom_event}
      </h2>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {descriptionHtml && (
          <InfoCard title="À propos de l'événement">
            <div
              className={cn(
                'prose prose-sm max-w-none text-left leading-relaxed text-muted-foreground [&>p]:mb-3 [&_*]:text-left',
                !showFullDescription && 'line-clamp-[12]',
              )}
              dangerouslySetInnerHTML={{ __html: sanitize(descriptionHtml) }}
            />
            <Button
              variant="link"
              size="sm"
              className="mt-1 h-auto p-0 text-primary"
              onClick={() => setShowFullDescription((v) => !v)}
            >
              {showFullDescription ? 'Voir moins' : 'En savoir plus'}
            </Button>
          </InfoCard>
        )}

        <InfoCard title="Préparer votre venue">
          <ul className="mb-4 space-y-3 text-sm text-muted-foreground">
            {dateLabel && (
              <li className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
                <span>{dateLabel}</span>
              </li>
            )}
            {event.nom_lieu && (
              <li className="flex items-start gap-2.5">
                <Building className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
                <span>{event.nom_lieu}</span>
              </li>
            )}
            {addressLine && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
                <span>{addressLine}</span>
              </li>
            )}
            {showTarif && (
              <li className="flex items-start gap-2.5">
                <Euro className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
                <span>{event.tarif}</span>
              </li>
            )}
          </ul>
          {mapAddress && <EventMapEmbed address={mapAddress} height={220} className="w-full" />}
        </InfoCard>
      </div>
    </section>
  );
}
