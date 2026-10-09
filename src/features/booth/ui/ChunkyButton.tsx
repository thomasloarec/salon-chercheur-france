import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChunkyVariant = 'primary' | 'secondary' | 'success';

const VARIANT: Record<ChunkyVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-[0_5px_0_hsl(var(--lx-violet-deep))]',
  secondary: 'border-2 border-border bg-background text-foreground shadow-[0_4px_0_hsl(var(--border))]',
  success: 'bg-success text-primary-foreground shadow-[0_5px_0_hsl(var(--lx-mint-deep))]',
};

export interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChunkyVariant;
  size?: 'md' | 'lg';
  loading?: boolean;
}

/** Bouton « en relief » : l'ombre disparaît et le bouton descend de 4 px à la pression. */
const ChunkyButton = forwardRef<HTMLButtonElement, ChunkyButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 whitespace-normal px-6 text-center text-lg font-extrabold leading-snug',
        'transition-[transform,box-shadow] duration-[80ms] ease-out motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'enabled:active:translate-y-[4px] enabled:active:shadow-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' ? 'min-h-[64px] rounded-[18px]' : 'min-h-[56px] rounded-2xl',
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
export default ChunkyButton;
