import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChoiceTone = 'primary' | 'flame' | 'info' | 'neutral' | 'success';

const TONE: Record<ChoiceTone, { selected: string; dot: string }> = {
  primary: {
    selected: 'border-primary bg-violet-soft shadow-[0_4px_0_hsl(var(--primary))]',
    dot: 'border-primary bg-primary text-primary-foreground',
  },
  flame: {
    selected: 'border-flame bg-flame-surface shadow-[0_4px_0_hsl(var(--lx-flame))]',
    dot: 'border-flame bg-flame text-foreground',
  },
  info: {
    selected: 'border-info bg-info-surface shadow-[0_4px_0_hsl(var(--info))]',
    dot: 'border-info bg-info text-info-foreground',
  },
  neutral: {
    selected: 'border-muted-foreground bg-muted shadow-[0_4px_0_hsl(var(--muted-foreground))]',
    dot: 'border-muted-foreground bg-muted-foreground text-background',
  },
  success: {
    selected: 'border-success bg-success-surface shadow-[0_4px_0_hsl(var(--lx-mint))]',
    dot: 'border-success bg-success text-primary-foreground',
  },
};

export const choiceLetter = (index: number) => String.fromCharCode(65 + (index % 26));

export interface ChoiceCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  index: number;
  selected?: boolean;
  tone?: ChoiceTone;
  icon?: LucideIcon;
  children: ReactNode;
}

const ChoiceCard = forwardRef<HTMLButtonElement, ChoiceCardProps>(
  ({ index, selected = false, tone = 'primary', icon: Icon, className, children, type = 'button', ...rest }, ref) => {
    const t = TONE[tone];
    return (
      <button
        ref={ref}
        type={type}
        data-choice=""
        aria-pressed={selected}
        className={cn(
          'flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border-2 px-4 py-3 text-left',
          'transition-[transform,box-shadow,background-color,border-color] duration-[80ms] motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'enabled:active:translate-y-[3px] enabled:active:shadow-none disabled:opacity-50',
          selected ? t.selected : 'border-border bg-background shadow-[0_4px_0_hsl(var(--border))]',
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          data-letter=""
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-extrabold',
            selected ? t.dot : 'border-border bg-background text-muted-foreground',
          )}
        >
          {choiceLetter(index)}
        </span>
        <span className={cn('min-w-0 flex-1 text-lg leading-snug text-foreground', selected ? 'font-extrabold' : 'font-bold')}>
          {children}
        </span>
        {Icon && <Icon className="h-6 w-6 shrink-0 text-foreground" aria-hidden="true" />}
      </button>
    );
  },
);
ChoiceCard.displayName = 'ChoiceCard';
export default ChoiceCard;
