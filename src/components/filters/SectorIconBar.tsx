import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectorIconMap, FallbackIcon } from "./sectorIconMap";

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

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' });
  };

  return (
    <div className={cn("relative", className)}>
      {/* Left scroll button - hidden on mobile */}
      <button
        onClick={scrollLeft}
        aria-label="Défiler vers la gauche"
        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm shadow-lg rounded-full p-2 hover:bg-background hover:shadow-xl transition-all"
      >
        <ChevronLeft className="h-5 w-5 text-foreground" />
      </button>

      {/* Scrollable container */}
      <div 
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide px-12 md:px-10 py-3"
      >
        {/* "Tout" button */}
        <button
          onClick={clearAll}
          aria-pressed={allActive}
          aria-label="Tous les secteurs"
          className={cn(
            "snap-start inline-flex items-center gap-2 rounded-full border shadow-sm px-4 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "hover:shadow-md hover:scale-105 cursor-pointer",
            allActive
              ? "bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-blue-500 text-blue-700 dark:text-blue-400"
              : "bg-background text-foreground hover:bg-muted border-border"
          )}
        >
          Tout
        </button>

        {/* Sector buttons */}
        {sectors.map((sector) => {
          const IconComponent = sectorIconMap[sector.slug] ?? FallbackIcon;
          const active = selected.includes(sector.slug);

          return (
            <button
              key={sector.id}
              onClick={() => toggle(sector.slug)}
              aria-pressed={active}
              aria-label={`Filtrer par secteur : ${sector.name}`}
              title={sector.name}
              className={cn(
                "snap-start inline-flex items-center gap-2 rounded-full border shadow-sm px-4 py-2.5 text-sm font-medium transition-all duration-200 shrink-0 whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "hover:shadow-md hover:scale-105 cursor-pointer",
                active
                  ? "bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border-blue-500 text-blue-700 dark:text-blue-400"
                  : "bg-background text-foreground hover:bg-muted border-border"
              )}
            >
              <IconComponent className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
              <span>{sector.name}</span>
            </button>
          );
        })}
      </div>

      {/* Right scroll button - hidden on mobile */}
      <button
        onClick={scrollRight}
        aria-label="Défiler vers la droite"
        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm shadow-lg rounded-full p-2 hover:bg-background hover:shadow-xl transition-all"
      >
        <ChevronRight className="h-5 w-5 text-foreground" />
      </button>
    </div>
  );
}
