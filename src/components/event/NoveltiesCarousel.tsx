import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import NoveltyEventCard from '@/components/novelty/NoveltyEventCard';
import type { Novelty } from '@/hooks/useNovelties';
import type { Event } from '@/types/event';

interface NoveltiesCarouselProps {
  novelties: Novelty[];
  event: Event;
  commentCounts?: Record<string, number>;
  /** Id de la nouveauté à sélectionner au montage (deep-link ?novelty=). */
  initialNoveltyId?: string | null;
  onActiveChange?: (noveltyId: string) => void;
}

const firstImage = (n: Novelty): string | undefined =>
  n.media_urls?.find((url) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url));

/**
 * Carousel de nouveautés — une nouveauté principale visible à la fois.
 * Les contrôles (flèches, dots, vignettes, clavier, swipe) n'apparaissent
 * qu'à partir de 2 nouveautés : le cas dominant est la carte unique.
 * Pas d'autoplay.
 */
export default function NoveltiesCarousel({
  novelties,
  event,
  commentCounts = {},
  initialNoveltyId,
  onActiveChange,
}: NoveltiesCarouselProps) {
  const count = novelties.length;
  const hasControls = count > 1;
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const appliedDeepLink = useRef<string | null>(null);

  // Deep-link : sélectionner la nouveauté ciblée, même si elle n'est pas la première.
  useEffect(() => {
    if (!initialNoveltyId) return;
    if (appliedDeepLink.current === initialNoveltyId) return;
    const target = novelties.findIndex((n) => n.id === initialNoveltyId);
    if (target >= 0) {
      appliedDeepLink.current = initialNoveltyId;
      setIndex(target);
    }
  }, [initialNoveltyId, novelties]);

  useEffect(() => {
    if (index > count - 1) setIndex(0);
  }, [count, index]);

  const active = novelties[Math.min(index, Math.max(count - 1, 0))];

  useEffect(() => {
    if (active) onActiveChange?.(active.id);
  }, [active, onActiveChange]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hasControls) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  };

  const thumbs = useMemo(
    () => novelties.map((n) => ({ id: n.id, title: n.title, image: firstImage(n) })),
    [novelties],
  );

  if (!active) return null;

  return (
    <div
      className="space-y-4"
      role="group"
      aria-roledescription={hasControls ? 'carrousel' : undefined}
      aria-label={hasControls ? `Nouveautés du salon (${count})` : undefined}
      tabIndex={hasControls ? 0 : undefined}
      onKeyDown={onKeyDown}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (!hasControls || touchStartX.current === null) return;
        const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        if (Math.abs(delta) > 48) go(delta < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
    >
      <div className={cn('flex gap-4', hasControls && 'items-start')}>
        {/* Carte principale */}
        <div className="min-w-0 flex-1">
          <div
            key={active.id}
            className="animate-in fade-in duration-200 motion-reduce:animate-none"
          >
            <NoveltyEventCard
              novelty={active}
              variant="feature"
              eventSlug={event.slug}
              eventDateDebut={event.date_debut}
              eventName={event.nom_event}
              eventVille={event.ville}
              event={event}
              commentCount={commentCounts[active.id] ?? 0}
            />
          </div>
        </div>

        {/* Vignettes latérales — à partir de 2 nouveautés, desktop uniquement */}
        {hasControls && (
          <div className="hidden lg:flex w-20 shrink-0 flex-col gap-2 max-h-[520px] overflow-y-auto">
            {thumbs.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Voir : ${t.title}`}
                aria-current={i === index}
                className={cn(
                  'relative aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted transition-all',
                  i === index
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border/60 opacity-70 hover:opacity-100',
                )}
              >
                {t.image ? (
                  <img
                    src={t.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-muted-foreground/50" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contrôles — uniquement à partir de 2 nouveautés */}
      {hasControls && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Nouveauté précédente"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2" role="tablist" aria-label="Nouveautés">
            {novelties.map((n, i) => (
              <button
                key={n.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Nouveauté ${i + 1} sur ${count}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-2 rounded-full transition-all duration-200 motion-reduce:transition-none',
                  i === index ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground/40',
                )}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Nouveauté suivante"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Liens crawlables vers toutes les nouveautés non affichées (SEO). */}
      {hasControls && (
        <ul className="sr-only">
          {novelties.map((n) => (
            <li key={n.id}>
              <a href={n.slug ? `/nouveautes/${n.slug}` : `/events/${event.slug}?novelty=${n.id}`}>
                {n.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
