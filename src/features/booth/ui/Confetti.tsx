import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCalmMotion } from './motion';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--lx-blue))', 'hsl(var(--lx-sky))', 'hsl(var(--lx-mint-bright))'];

export function confettiPieces(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.3;
    const dist = 60 + ((i * 37) % 50);
    return {
      id: i,
      round: i % 3 === 0,
      color: COLORS[i % COLORS.length],
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.6 - 30,
      rotate: (i * 53) % 360,
    };
  });
}

/** Confettis discrets qui partent du centre et retombent en 800 ms. Rien en mouvement réduit. */
export function ConfettiView({ count = 14, calm }: { count?: number; calm: boolean }) {
  const pieces = useMemo(() => confettiPieces(count), [count]);
  if (calm) return null;
  return (
    <div aria-hidden="true" data-confetti="" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className={p.round ? 'absolute h-1 w-1 rounded-full' : 'absolute h-2.5 w-[5px] rounded-[1px]'}
          style={{ backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 50], opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

export default function Confetti({ count = 14 }: { count?: number }) {
  const calm = useCalmMotion();
  return <ConfettiView count={count} calm={calm} />;
}
