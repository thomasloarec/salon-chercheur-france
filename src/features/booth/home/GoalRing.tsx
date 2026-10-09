import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCalmMotion } from '../ui/motion';
import CountUp from '../ui/CountUp';

const SIZE = 84;
const STROKE = 8;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Anneau d'objectif : se remplit de 0 à sa valeur en 700 ms, rebondit quand l'objectif est atteint. */
export default function GoalRing({ value, max, reached }: { value: number; max: number | null; reached: boolean }) {
  const calm = useCalmMotion();
  const prev = useRef(0);
  const from = prev.current;
  useEffect(() => {
    prev.current = value;
  }, [value]);
  const ratio = max ? Math.min(1, value / max) : value > 0 ? 1 : 0;
  const offset = C * (1 - ratio);
  return (
    <motion.div
      className="relative h-[84px] w-[84px] shrink-0"
      animate={reached && !calm ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, delay: 0.7 }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-booth-goal-track" />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          className="stroke-mint-bright"
          initial={calm ? false : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={calm ? { duration: 0 } : { duration: 0.7, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-background">
        <CountUp from={from} to={value} />
        {max ? <span>/{max}</span> : null}
      </span>
    </motion.div>
  );
}
