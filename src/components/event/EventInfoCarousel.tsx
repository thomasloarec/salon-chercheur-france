import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays, MapPin, Building, Euro, Users, Sparkles } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import EventMapEmbed from '@/components/maps/EventMapEmbed';
import { isTarifDisplayable, parseAffluence } from '@/lib/eventCapabilities';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/event';

interface EventInfoCarouselProps {
  event: Event;
}

const sanitize = (dirty: string) =>
  DOMPurify.sanitize(dirty, { ADD_TAGS: ['mark'], FORBID_ATTR: ['style'] });

function getSectors(event: Event): string[] {
  const secteur = event.secteur as unknown;
  if (!secteur) return [];
  if (Array.isArray(secteur)) return secteur.filter(Boolean) as string[];
  if (typeof secteur === 'string') {
    try {
      const parsed = JSON.parse(secteur);
      return Array.isArray(parsed) ? parsed : [secteur];
    } catch {
      return [secteur];
    }
  }
  return [];
}

function SlideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
      <h3 className="heading-display mb-4 text-xl text-foreground sm:text-2xl">{title}</h3>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}

/**
 * Lot 7 — Carousel unique d'informations sur le salon.
 * Remplace les blocs dispersés « À propos », « Préparer votre venue »
 * et « Pourquoi visiter ». Pas d'autoplay ; le contenu complet reste dans
 * le DOM (le « En savoir plus » est purement visuel, via line-clamp).
 */
export default function EventInfoCarousel({ event }: EventInfoCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  // --- Slide 1 : description longue -----------------------------------------
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

  // --- Slide 2 : venue -------------------------------------------------------
  const addressLine = [
    event.rue,
    event.code_postal && event.ville
      ? `${event.code_postal} ${event.ville}`
      : event.ville || event.code_postal,
    event.country || 'France',
  ]
    .filter(Boolean)
    .join(', ');

  const mapAddress =
    [event.nom_lieu, addressLine].filter(Boolean).join(', ') || null;
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

  // --- Slide 3 : pourquoi visiter (au moins 2 signaux réels) -----------------
  const sectors = getSectors(event);
  const affluenceValue = parseAffluence(event.affluence ?? null);
  const whySignals = [!!affluenceValue, sectors.length > 0].filter(Boolean).length;
  const showWhyVisit = whySignals >= 2;

  const slides: { key: string; node: React.ReactNode }[] = [];

  if (descriptionHtml) {
    slides.push({
      key: 'about',
      node: (
        <SlideCard title="À propos de l'événement">
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
        </SlideCard>
      ),
    });
  }

  slides.push({
    key: 'venue',
    node: (
      <SlideCard title="Préparer votre venue">
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
      </SlideCard>
    ),
  });

  if (showWhyVisit) {
    slides.push({
      key: 'why',
      node: (
        <SlideCard title={`Pourquoi visiter ${event.nom_event} ?`}>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
              <span>
                Rencontrez les{' '}
                <strong className="text-foreground">
                  {affluenceValue!.toLocaleString('fr-FR')}
                </strong>{' '}
                visiteurs professionnels attendus
                {event.ville ? ` à ${event.ville}` : ''}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
              <span>
                Découvrez les dernières innovations dans{' '}
                {sectors.length === 1 ? 'le secteur' : 'les secteurs'} :{' '}
                <strong className="text-foreground">{sectors.join(', ')}</strong>
              </span>
            </li>
          </ul>
        </SlideCard>
      ),
    });
  }

  if (slides.length === 0) return null;

  return (
    <section
      aria-label={`Informations sur ${event.nom_event}`}
      className="mx-auto w-full max-w-[1280px]"
    >
      <h2 className="heading-display mb-5 text-xl text-foreground sm:text-2xl">
        Tout savoir sur {event.nom_event}
      </h2>

      <Carousel setApi={setApi} opts={{ align: 'start', loop: false }} className="w-full">
        <CarouselContent className="-ml-4 items-stretch">
          {slides.map((slide) => (
            <CarouselItem key={slide.key} className="pl-4 basis-full lg:basis-[60%]">
              <div className="h-full">{slide.node}</div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {slides.length > 1 && (
          <>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </>
        )}
      </Carousel>

      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Aller à la carte ${i + 1}`}
              aria-current={i === current}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all motion-reduce:transition-none',
                i === current ? 'w-6 bg-primary' : 'w-1.5 bg-border',
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
