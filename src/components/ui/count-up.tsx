import { useEffect, useState } from 'react';
import { useInView, usePrefersReducedMotion } from '@/components/ui/reveal';

const frThousands = (n: number) => n.toLocaleString('fr-FR');
const defaultFormat = (v: number) => (v > 0 ? `${frThousands(v)}+` : '0');

/** Compteur 0 → target (easeOut 1,3 s), une seule fois ; valeur finale directe si reduced motion. */
export function CountUp({ target, format = defaultFormat }: { target: number; format?: (v: number) => string }) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView || target <= 0) return;
    if (reduced) { setValue(target); return; }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / 1300, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(step);
      else setValue(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, reduced]);
  return <span ref={ref}>{format(value)}</span>;
}

export default CountUp;
