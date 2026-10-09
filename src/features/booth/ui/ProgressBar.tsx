import { motion } from 'framer-motion';
import { SPRING, useCalmMotion } from './motion';

/** value entre 0 et 1. */
export default function ProgressBar({ value, label = 'Progression' }: { value: number; label?: string }) {
  const calm = useCalmMotion();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-4 w-full overflow-hidden rounded-full bg-secondary"
    >
      <motion.div
        className="h-full rounded-full bg-success shadow-[inset_0_-4px_0_hsl(var(--lx-mint-deep))]"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={calm ? { duration: 0 } : SPRING}
      />
    </div>
  );
}
