import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SPRING, useCalmMotion } from './motion';

/** value entre 0 et 1. Passe en menthe à la dernière étape. */
export default function ProgressBar({ value, label = 'Progression', done }: { value: number; label?: string; done?: boolean }) {
  const calm = useCalmMotion();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const last = done ?? pct >= 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-1.5 w-full overflow-hidden rounded-full bg-border"
    >
      <motion.div
        className={cn('h-full rounded-full', last ? 'bg-success' : 'bg-primary')}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={calm ? { duration: 0 } : SPRING}
      />
    </div>
  );
}
