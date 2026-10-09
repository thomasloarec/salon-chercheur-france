import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChunkyVariant = 'primary' | 'secondary' | 'success';

const VARIANT: Record<ChunkyVariant, string> = {
  primary: 'bg-primary font-semibold text-primary-foreground shadow-[0_1px_2px_hsl(var(--lx-shadow)/0.12)] min-h-[52px] lg:min-h-[54px]',
  secondary: 'border border-booth-line bg-background font-medium text-foreground shadow-[0_1px_2px_hsl(var(--lx-shadow)/0.05)] min-h-[48px]',
  success: 'bg-success font-semibold text-primary-foreground shadow-[0_1px_2px_hsl(var(--lx-shadow)/0.12)] min-h-[52px] lg:min-h-[54px]',
};

export interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChunkyVariant;
  /** Conservé pour compatibilité : la hauteur dépend désormais de la variante. */
  size?: 'md' | 'lg';
  loading?: boolean;
}

/** Bouton plat du mode salon : légère réduction (0,98) à la pression, sans déplacement. */
const ChunkyButton = forwardRef<HTMLButtonElement, ChunkyButtonProps>(
  ({ variant = 'primary', size: _size, loading = false, disabled, className, children, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 whitespace-normal rounded-xl px-6 py-2 text-center text-base leading-snug',
        'transition-transform duration-[80ms] ease-out motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'enabled:active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  ),
);
ChunkyButton.displayName = 'ChunkyButton';
export const AppButton = ChunkyButton;
export default ChunkyButton;
