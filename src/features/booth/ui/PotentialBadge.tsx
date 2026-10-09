import type { Interaction } from '@/lib/booth/types';
import { cn } from '@/lib/utils';
import { POTENTIAL } from '../salon/labels';
import { POTENTIAL_ICON } from './icons';

type Potential = NonNullable<Interaction['potential']>;

export const POTENTIAL_BADGE_CLASS: Record<Potential, string> = {
  hot: 'bg-flame-soft text-foreground',
  good: 'bg-violet-soft text-primary-deep',
  explore: 'bg-info-surface text-foreground',
  none: 'bg-muted text-muted-foreground',
};

export default function PotentialBadge({ value, className }: { value: Potential; className?: string }) {
  const Icon = POTENTIAL_ICON[value];
  return (
    <span
      data-potential={value}
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', POTENTIAL_BADGE_CLASS[value], className)}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', value === 'hot' && 'text-flame-deep', value === 'explore' && 'text-info')} aria-hidden="true" />
      {POTENTIAL[value]}
    </span>
  );
}
