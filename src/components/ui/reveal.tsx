import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lot 11 — utilitaires d'animation partagés, extraits du traitement déjà en
 * place sur la page d'accueil (src/pages/Home.tsx). Aucune nouvelle direction
 * artistique : mêmes primitives, amplitude réduite pour la page salon.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

export function useInView<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        // once : on déconnecte dès la première apparition, jamais rejouée.
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

interface RevealProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Révélation au scroll : opacité 0 → 1, translation verticale 10 px,
 * 450 ms ease-out, une seule fois. Neutralisée par prefers-reduced-motion.
 * N'ajoute aucune réservation d'espace : le nœud garde son flux normal,
 * donc aucun décalage de mise en page (CLS inchangé).
 */
export const Reveal: React.FC<RevealProps> = ({ children, className }) => {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.12);
  const shown = reduced || inView;

  return (
    <div
      ref={ref}
      className={cn(
        'empty:hidden transition-[opacity,transform] duration-[450ms] ease-out motion-reduce:transition-none',
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[10px]',
        className,
      )}
    >
      {children}
    </div>
  );
};

export default Reveal;
