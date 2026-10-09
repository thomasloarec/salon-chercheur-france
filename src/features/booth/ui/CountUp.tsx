import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';
import { useCalmMotion } from './motion';

/** Chiffre qui défile de from à to en 400 ms. */
export default function CountUp({ from, to }: { from: number; to: number }) {
  const calm = useCalmMotion();
  const [v, setV] = useState(calm ? to : from);
  useEffect(() => {
    if (calm || from === to) return setV(to);
    const c = animate(from, to, { duration: 0.4, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [from, to, calm]);
  return <span className="tabular-nums">{v}</span>;
}
