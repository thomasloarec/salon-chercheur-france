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

  return (
    <div className={cn("space-y-3", className)}>
      {/* Desktop: flex-wrap, Mobile: horizontal scroll */}
      <div className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        {/* "Tout" button */}
        <button
          onClick={clearAll}
          aria-pressed={allActive}
          aria-label="Tous les secteurs"
          className={cn(
            "snap-start inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            allActive
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground hover:bg-muted"
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
                "snap-start inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors shrink-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "min-w-[140px] max-w-[200px]",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground hover:bg-muted"
              )}
            >
              <IconComponent className="h-4 w-4 shrink-0" />
              <span className="truncate">{sector.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
