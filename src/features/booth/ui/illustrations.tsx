import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useCalmMotion } from './motion';

const base = { width: 180, height: 140, viewBox: '0 0 180 140', fill: 'none', 'aria-hidden': true as const, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function StandIllustration() {
  return (
    <svg {...base}>
      <ellipse cx="90" cy="124" rx="70" ry="8" className="fill-booth-pill" />
      <rect x="34" y="28" width="112" height="22" rx="4" className="fill-booth-good-bg stroke-primary" />
      <path d="M50 39h40" className="stroke-primary" />
      <path d="M40 50v68M140 50v68" className="stroke-muted-foreground" />
      <rect x="56" y="80" width="68" height="38" rx="4" className="fill-background stroke-muted-foreground" />
      <path d="M56 92h68" className="stroke-booth-line" />
      <circle cx="132" cy="70" r="7" className="fill-booth-sky stroke-booth-explore-fg" />
      <path d="M122 118c0-14 4-34 10-34s10 20 10 34" className="stroke-booth-explore-fg" />
      <path d="M70 66l6-10 6 10" className="stroke-mint" />
    </svg>
  );
}

export function CheckIllustration() {
  return (
    <svg {...base}>
      <circle cx="90" cy="68" r="44" className="fill-mint-surface" />
      <circle cx="90" cy="68" r="30" className="fill-background stroke-mint" />
      <path d="M76 68l10 10 18-20" className="stroke-mint-deep" strokeWidth={3} />
    </svg>
  );
}

export function CalendarIllustration() {
  return (
    <svg {...base}>
      <rect x="44" y="30" width="92" height="84" rx="8" className="fill-background stroke-muted-foreground" />
      <rect x="44" y="30" width="92" height="20" rx="8" className="fill-booth-good-bg stroke-primary" />
      <path d="M66 22v16M114 22v16" className="stroke-primary" />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}-${c}`} x={56 + c * 18} y={60 + r * 16} width="10" height="8" rx="2" className="fill-booth-pill" />))}
    </svg>
  );
}

export function SearchIllustration() {
  return (
    <svg {...base}>
      <circle cx="82" cy="62" r="30" className="fill-booth-sky stroke-booth-explore-fg" />
      <path d="M104 84l26 26" className="stroke-muted-foreground" strokeWidth={4} />
      <path d="M70 62h24" className="stroke-booth-explore-fg" />
    </svg>
  );
}

/** État vide : illustration, titre et texte, apparition douce une fois. */
export function EmptyState({ art, title, text, children }: { art: ReactNode; title: string; text?: string; children?: ReactNode }) {
  const calm = useCalmMotion();
  return (
    <motion.div
      data-empty=""
      className="flex flex-col items-center gap-2 px-4 py-6 text-center"
      initial={calm ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {art}
      <p className="text-lg font-semibold leading-snug">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      {children && <div className="mt-2 flex w-full max-w-sm flex-col items-center gap-2">{children}</div>}
    </motion.div>
  );
}
