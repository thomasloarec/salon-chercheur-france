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
    <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_hsl(var(--foreground)/0.06)] sm:p-7">
      {/* Filet violet vertical : accent discret en tête de bloc */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
      <h3 className="heading-display mb-4 text-xl text-foreground sm:text-2xl">{title}</h3>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}

/** Ligne d'information pratique : icône violette, libellé discret, valeur. */
function PracticalRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-violet-soft">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="block text-sm text-foreground">{value}</span>
      </span>
    </li>
  );
}

/**
 * Lot 13 — zone « Tout savoir sur … ».
 * Deux blocs côte à côte : « À propos » (chapô + corps) et « Préparer votre
 * venue » (liste structurée + carte Google dominante).
 *
 * La description longue reste entière dans le DOM (SEO) : « En savoir plus »
 * ne fait que retirer le line-clamp.
 */
export default function EventInfoBlocks({ event }: EventInfoBlocksProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  const { lead, bodyHtml } = useMemo(() => {
    const isEnriched =
      event.enrichissement_statut === 'valide' && !!event.description_enrichie;
    const raw = isEnriched ? event.description_enrichie! : event.description_event || '';
    if (!raw.trim()) return { lead: '', bodyHtml: '' };

    if (isEnriched) {
      const paragraphs = raw.split(/\n\n+/).filter((p) => p.trim());
      const [first, ...rest] = paragraphs;
      return {
        lead: first?.replace(/\n/g, ' ') ?? '',
        bodyHtml: rest.map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join(''),
      };
    }
    return { lead: '', bodyHtml: raw };
  }, [event.description_enrichie, event.description_event, event.enrichissement_statut]);

  const hasDescription = !!(lead || bodyHtml);

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
      <h2 className="heading-display mb-5 text-xl text-foreground sm:text-2xl">
        Tout savoir sur {event.nom_event}
      </h2>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {hasDescription && (
          <InfoCard title="À propos de l'événement">
            <div className={cn(!showFullDescription && 'line-clamp-[12]')}>
              {lead && (
                <p className="mb-3 text-[17px] font-medium leading-relaxed text-foreground">
                  {lead}
                </p>
              )}
              {bodyHtml && (
                <div
                  className="prose prose-sm max-w-none text-left leading-relaxed text-muted-foreground [&>p]:mb-3 [&_*]:text-left"
                  dangerouslySetInnerHTML={{ __html: sanitize(bodyHtml) }}
                />
              )}
            </div>
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
          <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
            <ul className="space-y-4">
              {dateLabel && <PracticalRow icon={CalendarDays} label="Dates" value={dateLabel} />}
              {event.nom_lieu && (
                <PracticalRow icon={Building} label="Lieu" value={event.nom_lieu} />
              )}
              {addressLine && (
                <PracticalRow icon={MapPin} label="Adresse" value={addressLine} />
              )}
              {showTarif && <PracticalRow icon={Euro} label="Tarif" value={event.tarif} />}
            </ul>

            {mapAddress && (
              <EventMapEmbed
                address={mapAddress}
                height={280}
                className="w-full sm:min-h-[280px]"
              />
            )}
          </div>
        </InfoCard>
      </div>
    </section>
  );
}
