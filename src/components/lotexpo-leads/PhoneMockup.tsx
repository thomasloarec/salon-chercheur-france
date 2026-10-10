import {
  Mic, QrCode, Camera, Plus, Check, Phone, FileText, Receipt, CalendarDays, Ban, ChevronRight, ChevronLeft,
  ListChecks, Users, LayoutDashboard, BarChart3, WifiOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import PotentialBadge from '@/features/booth/ui/PotentialBadge';
import { useInView, usePrefersReducedMotion } from '@/components/ui/reveal';
import { cn } from '@/lib/utils';
import { PhoneFrame } from './DeviceFrames';

type Pot = 'hot' | 'good' | 'explore';
const CARD = 'rounded-xl border border-border bg-card';

const C = 2 * Math.PI * 38;
/** Anneau 9/12 : se remplit une fois en 700 ms à l'arrivée à l'écran. */
export function Ring({ run, size = 84 }: { run: boolean; size?: number }) {
  const reduced = usePrefersReducedMotion();
  const target = C * (1 - 9 / 12);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 84 84" className="-rotate-90">
        <circle cx={42} cy={42} r={38} fill="none" strokeWidth={8} className="stroke-booth-goal-track" />
        <motion.circle
          cx={42} cy={42} r={38} fill="none" strokeWidth={8} strokeLinecap="round" strokeDasharray={C}
          className="stroke-success-bright"
          initial={reduced ? false : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: run || reduced ? target : C }}
          transition={reduced ? { duration: 0 } : { duration: 0.7, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-background">9/12</span>
    </div>
  );
}

export const TILES = [{ i: Mic, l: 'Dicter' }, { i: QrCode, l: 'Badge QR' }, { i: Camera, l: 'Carte' }];

const LAST: { n: string; c: string; p: Pot; t: string }[] = [
  { n: 'Marie Dubois', c: 'Schneider Electric', p: 'hot', t: '16:42' },
  { n: 'Paul Roux', c: 'Legrand', p: 'good', t: '16:20' },
  { n: 'Inès Kaci', c: 'Veolia', p: 'explore', t: '15:58' },
  { n: 'Hugo Martin', c: 'Saint-Gobain', p: 'good', t: '15:31' },
];

/** Accueil du salon (390 px de large). */
export function HomeScreen({ run }: { run: boolean }) {
  return (
    <div className="flex h-full flex-col gap-4 px-5 pb-8 pt-2">
      <div>
        <p className="text-[15px] font-medium text-muted-foreground">Jour 2 sur 3 · Stand B42</p>
        <p className="text-[26px] font-semibold leading-tight">SEPEM Grenoble</p>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-mint-deep"><WifiOff size={15} /> Disponible sans réseau</p>
      </div>
      <div className="flex items-center gap-4 rounded-2xl bg-booth-navy p-4">
        <Ring run={run} />
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-background">Objectif du jour</p>
          <p className="text-[14px] text-booth-on-navy">Encore 3 rencontres pour l'équipe</p>
          <p className="mt-1 text-[14px] font-medium text-booth-sky-text">2 chaudes</p>
        </div>
      </div>
      <div className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground">
        <Plus size={20} /> Nouvelle rencontre
      </div>
      <div className="grid grid-cols-3 gap-2">
        {TILES.map(({ i: I, l }) => (
          <div key={l} className={cn(CARD, 'flex h-12 items-center gap-2 px-2.5 text-[14px] font-medium')}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-booth-good-bg"><I size={15} className="text-primary" /></span>
            {l}
          </div>
        ))}
      </div>
      <div className={cn(CARD, 'divide-y divide-border')}>
        {[
          { i: Users, l: 'Rencontres du salon', v: '14' },
          { i: ListChecks, l: 'Actions à faire', v: '3', pill: true },
          { i: LayoutDashboard, l: 'Tableau de bord' },
        ].map(({ i: I, l, v, pill }) => (
          <div key={l} className="flex h-12 items-center gap-3 px-4 text-[15px] font-medium">
            <I size={18} className="text-primary" />
            <span className="flex-1">{l}</span>
            {v && <span className={pill ? 'rounded-full bg-primary px-2 text-[13px] text-primary-foreground' : 'text-muted-foreground'}>{v}</span>}
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <p className="mb-2 text-[15px] font-semibold">Dernières rencontres</p>
        <div className={cn(CARD, 'divide-y divide-border')}>
          {LAST.map((m) => (
            <div key={m.n} className="flex items-center gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{m.n}</p>
                <p className="truncate text-[13px] text-muted-foreground">{m.c}</p>
              </div>
              <PotentialBadge value={m.p} className="shrink-0" />
              <span className="w-10 text-right text-[13px] text-muted-foreground">{m.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomePhone({ width = 300 }: { width?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref}>
      <PhoneFrame width={width} label="Aperçu de l'accueil du salon dans Lotexpo Leads">
        <HomeScreen run={inView} />
      </PhoneFrame>
    </div>
  );
}

export default HomePhone;

export function ActionPhone({ width = 260 }: { width?: number }) {
  const items = [
    { i: Phone, l: 'Rappeler' },
    { i: FileText, l: 'Envoyer une documentation' },
    { i: Receipt, l: 'Envoyer un devis', on: true },
    { i: CalendarDays, l: 'Prendre rendez-vous' },
    { i: Ban, l: 'Aucune action' },
  ];
  return (
    <PhoneFrame width={width} label="Aperçu de l'étape Prochaine action">
      <div className="flex h-full flex-col px-5 pb-8 pt-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full w-4/5 rounded-full bg-primary" /></div>
        <div className="mt-3 flex items-center justify-between text-[15px] font-medium text-muted-foreground">
          <span className="flex items-center gap-1"><ChevronLeft size={18} /> Retour</span>
          <span>4/5</span>
        </div>
        <p className="mt-6 text-[26px] font-semibold leading-tight">Quelle est la prochaine action ?</p>
        <div className="mt-6 space-y-3">
          {items.map(({ i: I, l, on }) => (
            <div key={l} className={cn('flex h-[60px] items-center gap-3 rounded-xl border px-4 text-[16px] font-medium', on ? 'border-2 border-primary bg-booth-good-bg' : 'border-border bg-card')}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-booth-sky"><I size={18} className="text-primary" /></span>
              <span className="flex-1">{l}</span>
              {on && <Check size={20} className="text-primary" />}
            </div>
          ))}
        </div>
        <div className="mt-auto flex h-14 items-center justify-center rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground">Continuer</div>
      </div>
    </PhoneFrame>
  );
}

export function SavedPhone({ width = 260 }: { width?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const reduced = usePrefersReducedMotion();
  return (
    <div ref={ref}>
      <PhoneFrame width={width} label="Aperçu de l'écran Rencontre enregistrée">
        <div className="flex h-full flex-col px-5 pb-8 pt-10">
          <div className="flex flex-col items-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-mint">
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" className="stroke-background" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: inView || reduced ? 1 : 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
                />
              </svg>
            </span>
            <p className="mt-5 text-[26px] font-semibold">Rencontre enregistrée</p>
          </div>
          <div className={cn(CARD, 'mt-8 p-4')}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[17px] font-semibold">Marie Dubois</p>
              <PotentialBadge value="hot" />
            </div>
            <p className="text-[14px] text-muted-foreground">Schneider Electric</p>
            <p className="mt-3 flex items-center gap-2 text-[15px] font-medium"><Receipt size={16} className="text-primary" /> Devis avant le 18/10</p>
          </div>
          <div className={cn(CARD, 'mt-4 p-4')}>
            <div className="flex justify-between text-[15px] font-medium"><span>Objectif du jour</span><span>10/12</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full w-5/6 rounded-full bg-success-bright" /></div>
          </div>
          <div className="mt-auto space-y-3">
            <div className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground"><Plus size={20} /> Nouvelle rencontre</div>
            <div className="flex h-14 items-center justify-center rounded-xl border border-border bg-card text-[17px] font-semibold">Retour à l'accueil</div>
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}

export { BarChart3 };
