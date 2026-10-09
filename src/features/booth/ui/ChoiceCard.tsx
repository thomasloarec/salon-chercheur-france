import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChoiceTone = 'primary' | 'flame' | 'info' | 'neutral' | 'success';

/** Couleur de la pastille d'icône quand le choix est fait. */
const TONE_PILL: Record<ChoiceTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  flame: 'bg-flame text-foreground',
  info: 'bg-info text-info-foreground',
  neutral: 'bg-muted-foreground text-background',
  success: 'bg-success text-primary-foreground',
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
    const letter = choiceLetter(index);
    return (
      <button
        ref={ref}
        type={type}
        data-choice=""
        aria-pressed={selected}
        className={cn(
          'flex min-h-[54px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left',
          'shadow-[0_1px_2px_hsl(var(--lx-shadow)/0.05)]',
          'transition-[transform,background-color,border-color] duration-[80ms] motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'enabled:active:scale-[0.98] disabled:opacity-50',
          selected
            ? 'border-primary bg-booth-choice outline outline-[0.5px] outline-primary'
            : 'border-border bg-background',
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          data-pill=""
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-medium',
            selected ? TONE_PILL[tone] : 'bg-booth-pill text-muted-foreground',
          )}
        >
          {Icon ? <Icon className="h-[18px] w-[18px]" /> : letter}
        </span>
        <span
          data-label=""
          className={cn('min-w-0 flex-1 break-words text-base leading-snug text-foreground', selected ? 'font-semibold' : 'font-medium')}
        >
          {children}
        </span>
        {selected ? (
          <Check data-check="" className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          Icon && (
            <span
              aria-hidden="true"
              data-letter=""
              className="hidden h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border border-border text-[11px] text-muted-foreground lg:flex"
            >
              {letter}
            </span>
          )
        )}
      </button>
    );
  },
);
ChoiceCard.displayName = 'ChoiceCard';
export default ChoiceCard;
