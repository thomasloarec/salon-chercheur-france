import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectorIconMap, FallbackIcon } from "./sectorIconMap";
import { sectorColorMap, sectorColorFallback } from "./sectorColorMap";

interface Sector {
  id: string;
  slug: string;
  name: string;
}

interface SectorIconBarProps {
  sectors: Sector[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function SectorIconBar({
  sectors,
  selected,
  onChange,
  className
}: SectorIconBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const toggle = (slug: string) => {
    const set = new Set(selected);
    if (set.has(slug)) {
      set.delete(slug);
    } else {
      set.add(slug);
    }
    onChange(Array.from(set));
  };

  const clearAll = () => onChange([]);

  const allActive = selected.length === 0;

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 4);
    setCanRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);
    // Micro-refresh after paint
    requestAnimationFrame(updateArrows);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [sectors]);

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Inline layout: left arrow — scrollable container — right arrow */}
      <div className="flex items-center gap-2">
        {/* Left arrow (hidden when at start) */}
        {canLeft ? (
          <button
            onClick={() => scrollBy(-320)}
            aria-label="Défiler vers la gauche"
            className="hidden md:flex shrink-0 rounded-full border bg-background/80 backdrop-blur-sm shadow-lg p-2 hover:bg-background hover:shadow-xl transition-all"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        ) : (
          <div className="hidden md:block w-9 shrink-0" aria-hidden="true" />
        )}

        {/* Scrollable container with no visible scrollbar */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto no-scrollbar scroll-smooth"
        >
          <div className="flex items-stretch gap-4 px-1 py-3">
            {/* "Tout" button */}
            <button
              onClick={clearAll}
              aria-pressed={allActive}
              aria-label="Tous les secteurs"
              className={cn(
                "group flex w-24 flex-col items-center gap-2 text-sm font-medium shrink-0"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-14 w-14 items-center justify-center rounded-full border shadow-sm transition-all duration-200",
                  allActive
                    ? "bg-gradient-to-br from-blue-200/60 via-purple-200/60 to-pink-200/60 border-blue-500 dark:from-blue-900/40 dark:via-purple-900/40 dark:to-pink-900/40"
                    : "bg-background border-border hover:bg-muted hover:shadow-md hover:scale-105"
                )}
              >
                <span className="text-xl">✨</span>
              </span>
              <span
                className={cn(
                  "text-center leading-tight transition-colors",
                  allActive ? "text-blue-700 dark:text-blue-400" : "text-foreground/80 group-hover:text-foreground"
                )}
              >
                Tout
              </span>
            </button>

            {/* Sector buttons: icon ABOVE label */}
            {sectors.map((sector) => {
              const IconComponent = sectorIconMap[sector.slug] ?? FallbackIcon;
              const active = selected.includes(sector.slug);
              const colors = sectorColorMap[sector.slug] ?? sectorColorFallback;

              return (
                <button
                  key={sector.id}
                  onClick={() => toggle(sector.slug)}
                  aria-pressed={active}
                  aria-label={`Filtrer par secteur : ${sector.name}`}
                  title={sector.name}
                  className={cn(
                    "group flex w-28 flex-col items-center gap-2 text-sm font-medium shrink-0"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-14 w-14 items-center justify-center rounded-full border shadow-sm transition-all duration-200",
                      active
                        ? `${colors.bgActive} ${colors.borderActive}`
                        : `bg-background border-border ${colors.bgHover} hover:shadow-md hover:scale-105`
                    )}
                  >
                    <IconComponent 
                      className={cn(
                        "h-6 w-6 transition-colors",
                        active ? colors.iconActive : "text-foreground/70"
                      )} 
                    />
                  </span>
                  <span
                    className={cn(
                      "text-center leading-tight transition-colors line-clamp-2",
                      active ? colors.textActive : `text-foreground/80 ${colors.textHover}`
                    )}
                  >
                    {sector.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right arrow (hidden when at end) */}
        {canRight ? (
          <button
            onClick={() => scrollBy(320)}
            aria-label="Défiler vers la droite"
            className="hidden md:flex shrink-0 rounded-full border bg-background/80 backdrop-blur-sm shadow-lg p-2 hover:bg-background hover:shadow-xl transition-all"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        ) : (
          <div className="hidden md:block w-9 shrink-0" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
