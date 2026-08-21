import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import NoveltyEventCard from '@/components/novelty/NoveltyEventCard';
import type { Novelty } from '@/hooks/useNovelties';
import type { Event } from '@/types/event';

/** Lot 15 — cadence du défilement automatique (décision produit du 20/08/2026). */
const AUTOPLAY_INTERVAL_MS = 7000;

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

  // ── Défilement automatique (lot 15) ────────────────────────────────────
  // Autorisé UNIQUEMENT ici, jamais sur les autres carousels du site.
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const autoplayEligible = hasControls && !prefersReducedMotion;
  /** Arrêt définitif : le visiteur a pris la main (flèche, dot, swipe). */
  const [stopped, setStopped] = useState(false);
  /** Pause du bouton de contrôle (WCAG 2.2.2). */
  const [userPaused, setUserPaused] = useState(false);
  /** Pauses temporaires : survol, focus clavier, onglet masqué. */
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tabHidden, setTabHidden] = useState(
    typeof document !== 'undefined' ? document.hidden : false,
  );

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const stopAutoplay = useCallback(() => setStopped(true), []);

  const playing = autoplayEligible && !stopped && !userPaused && !hovered && !focused && !tabHidden;

  useEffect(() => {
    if (!playing) return;
    // Pas de rattrapage accéléré : un simple intervalle, remis à zéro à chaque
    // reprise, avance d'une slide à la fois.
    const timer = window.setInterval(() => {
      scrollToIndex((index + 1) % count);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, index, count, scrollToIndex]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hasControls) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stopAutoplay();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stopAutoplay();
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
      aria-live="off"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          onPointerDown={stopAutoplay}
          onTouchStart={stopAutoplay}
          onWheel={stopAutoplay}
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
          onClick={() => {
            stopAutoplay();
            go(-1);
          }}
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
              onClick={() => {
                stopAutoplay();
                scrollToIndex(i);
              }}
              className={cn(
                'h-2 rounded-full transition-all duration-200 motion-reduce:transition-none',
                i === index ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground/40',
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            stopAutoplay();
            go(1);
          }}
          aria-label="Nouveauté suivante"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* WCAG 2.2.2 — contrôle de pause visible dès que l'autoplay est actif */}
        {autoplayEligible && !stopped && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={
              userPaused
                ? 'Reprendre le défilement automatique des nouveautés'
                : 'Mettre en pause le défilement automatique des nouveautés'
            }
            aria-pressed={userPaused}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {userPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        )}
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
