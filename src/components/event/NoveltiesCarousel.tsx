import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

/**
 * Carousel de nouveautés en pleine largeur (lot 8).
 *
 * Mécanique : scroll horizontal natif + scroll-snap. Aucune translation
 * calculée en JavaScript ; les flèches et les points pilotent un `scrollTo`.
 * Le swipe mobile, le trackpad et le redimensionnement sont gratuits.
 *
 * Une seule nouveauté (cas dominant) : aucun contrôle, aucun aperçu, et la
 * composition est contenue pour ne pas paraître étirée.
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
  const trackRef = useRef<HTMLDivElement>(null);
  const appliedDeepLink = useRef<string | null>(null);

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const track = trackRef.current;
    const slide = track?.children[i] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({
      left: slide.offsetLeft - track.offsetLeft,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // Deep-link : sélectionner la nouveauté ciblée, même si elle n'est pas la première.
  useEffect(() => {
    if (!initialNoveltyId) return;
    if (appliedDeepLink.current === initialNoveltyId) return;
    const target = novelties.findIndex((n) => n.id === initialNoveltyId);
    if (target >= 0) {
      appliedDeepLink.current = initialNoveltyId;
      setIndex(target);
      requestAnimationFrame(() => scrollToIndex(target, false));
    }
  }, [initialNoveltyId, novelties, scrollToIndex]);

  // Index actif déduit de la position de scroll (source de vérité : le DOM).
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children) as HTMLElement[];
    let best = 0;
    let bestDist = Infinity;
    children.forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft - track.offsetLeft - track.scrollLeft);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setIndex((prev) => (prev === best ? prev : best));
  }, []);

  const active = novelties[Math.min(index, Math.max(count - 1, 0))];

  useEffect(() => {
    if (active) onActiveChange?.(active.id);
  }, [active, onActiveChange]);

  const go = useCallback(
    (delta: number) => {
      scrollToIndex((index + delta + count) % count);
    },
    [index, count, scrollToIndex],
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

  if (!active) return null;

  // Cas dominant : une seule nouveauté → composition contenue, plein cadre.
  if (!hasControls) {
    return (
      <div className="mx-auto w-full max-w-4xl">
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
    );
  }

  return (
    <div
      className="space-y-4"
      role="group"
      aria-roledescription="carrousel"
      aria-label={`Nouveautés du salon (${count})`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className={cn(
            'flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-1',
            'motion-reduce:scroll-auto',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {novelties.map((n) => (
            <div
              key={n.id}
              className="w-[88%] flex-none snap-start md:w-[90%] lg:w-[86%] xl:w-[84%]"
            >
              <NoveltyEventCard
                novelty={n}
                variant="feature"
                eventSlug={event.slug}
                eventDateDebut={event.date_debut}
                eventName={event.nom_event}
                eventVille={event.ville}
                event={event}
                commentCount={commentCounts[n.id] ?? 0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Contrôles — uniquement à partir de 2 nouveautés */}
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
              onClick={() => scrollToIndex(i)}
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

      {/* Liens crawlables vers toutes les nouveautés (SEO). */}
      <ul className="sr-only">
        {novelties.map((n) => (
          <li key={n.id}>
            <a href={n.slug ? `/nouveautes/${n.slug}` : `/events/${event.slug}?novelty=${n.id}`}>
              {n.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
