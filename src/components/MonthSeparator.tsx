import { cn } from '@/lib/utils';

interface MonthSeparatorProps {
  label: string;
  count: number;
  ongoing?: boolean;
  /** Optional sticky offset (e.g. "calc(4rem + 3.5rem)"). When omitted, the separator is not sticky. */
  stickyTop?: string;
  className?: string;
}

/**
 * Shared month separator used across listing pages (/salons, /ville/*, /secteur/*).
 * Single source of truth for typography and layout — do not fork.
 */
export function MonthSeparator({ label, count, ongoing = false, stickyTop, className }: MonthSeparatorProps) {
  const isSticky = Boolean(stickyTop);
  return (
    <div
      className={cn(
        '-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60',
        isSticky && 'sticky z-20',
        className,
      )}
      style={isSticky ? { top: stickyTop } : undefined}
    >
      <div className="flex items-center gap-3 py-3">
        {ongoing && (
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        )}
        <h2 className="heading-display text-xl md:text-2xl text-foreground capitalize">
          {label}
        </h2>
        <span className="flex-1 h-px bg-border/70" aria-hidden="true" />
        <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 shrink-0">
          {count} salon{count > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

export default MonthSeparator;