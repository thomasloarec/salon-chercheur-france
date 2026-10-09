import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Puce de filtre du mode salon : bordure 1 px, choisie en violet clair. */
export default function Chip({ selected = false, className, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border px-4 text-sm font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary/40 bg-booth-good-bg text-primary-deep' : 'border-border bg-background text-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
