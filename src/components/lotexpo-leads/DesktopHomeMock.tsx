import { Plus, ChevronRight, ListChecks, Users, LayoutDashboard, BarChart3 } from 'lucide-react';
import PotentialBadge from '@/features/booth/ui/PotentialBadge';
import { useInView, usePrefersReducedMotion } from '@/components/ui/reveal';
import { cn } from '@/lib/utils';
import { Ring, TILES } from './PhoneMockup';

type Pot = 'hot' | 'good' | 'explore';
export const DESKTOP_ROWS: { t: string; n: string; c: string; p: Pot; a: string; s: string }[] = [
  { t: '16:42', n: 'Marie Dubois', c: 'Schneider Electric', p: 'hot', a: 'Devis', s: 'TL' },
  { t: '16:20', n: 'Paul Roux', c: 'Legrand', p: 'good', a: 'Rappeler', s: 'SB' },
  { t: '15:58', n: 'Inès Kaci', c: 'Veolia', p: 'explore', a: 'Envoyer une doc', s: 'AM' },
  { t: '15:31', n: 'Hugo Martin', c: 'Saint-Gobain', p: 'good', a: 'Rendez-vous', s: 'TL' },
  { t: '14:47', n: 'Claire Petit', c: 'Engie', p: 'hot', a: 'Devis', s: 'SB' },
  { t: '14:10', n: 'Yann Le Gall', c: 'Bouygues Énergies', p: 'good', a: 'Rappeler', s: 'AM' },
  { t: '11:35', n: 'Sophie Blanc', c: 'Dalkia', p: 'explore', a: 'Aucune', s: 'TL' },
];
const CARD = 'rounded-xl border border-border bg-card';

/** Accueil du salon en mise en page ordinateur, 1280 × 760 (sous la barre du navigateur). */
export default function DesktopHomeMock() {
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  const reduced = usePrefersReducedMotion();
  const shown = inView || reduced;
  return (
    <div ref={ref} className="flex h-full flex-col bg-booth-canvas text-foreground">
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-8">
        <span className="text-[18px] font-semibold">Lotexpo <span className="text-primary">Leads</span></span>
        <span className="flex items-center gap-4 text-[14px] font-medium">
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-mint" /> Synchronisé</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-booth-good-bg text-[13px] font-semibold text-primary-deep">TL</span>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 gap-8 p-8">
        <div className="flex w-[380px] shrink-0 flex-col gap-4">
          <div>
            <p className="text-[14px] font-medium text-muted-foreground">Jour 2 sur 3 · Stand B42</p>
            <p className="text-[26px] font-semibold leading-tight">SEPEM Grenoble</p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-booth-navy p-4">
            <Ring run={inView} />
            <div>
              <p className="text-[17px] font-semibold text-background">Objectif du jour</p>
              <p className="text-[14px] text-booth-on-navy">Encore 3 rencontres pour l'équipe</p>
            </div>
          </div>
          <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-semibold text-primary-foreground"><Plus size={18} /> Nouvelle rencontre</div>
          <div className="grid grid-cols-3 gap-2">
            {TILES.map(({ i: I, l }, k) => (
              <div key={l} className={cn(CARD, 'flex h-11 items-center gap-2 px-2.5 text-[14px] font-medium')}>
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-[12px] font-semibold text-muted-foreground">{'ABC'[k]}</span>
                <I size={15} className="text-primary" />{l}
              </div>
            ))}
          </div>
          <div className={cn(CARD, 'divide-y divide-border')}>
            {[
              { i: Users, l: 'Rencontres du salon', v: '14' },
              { i: ListChecks, l: 'Actions à faire', v: '3', pill: true },
              { i: LayoutDashboard, l: 'Tableau de bord' },
              { i: BarChart3, l: 'Bilan du salon' },
            ].map(({ i: I, l, v, pill }) => (
              <div key={l} className="flex h-11 items-center gap-3 px-4 text-[15px] font-medium">
                <I size={17} className="text-primary" /><span className="flex-1">{l}</span>
                {v && <span className={pill ? 'rounded-full bg-primary px-2 text-[13px] text-primary-foreground' : 'text-muted-foreground'}>{v}</span>}
                <ChevronRight size={15} className="text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            {[['14', "rencontres aujourd'hui"], ['5', 'chaudes'], ['3', 'actions à faire']].map(([v, l]) => (
              <div key={l} className={cn(CARD, 'p-4')}>
                <p className="text-[28px] font-semibold leading-none">{v}</p>
                <p className="mt-1 text-[14px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-[18px] font-semibold">Dernières rencontres</p>
            <span className="text-[14px] font-medium text-primary">Tout voir</span>
          </div>
          <div className={cn(CARD, 'overflow-hidden')}>
            <div className="grid grid-cols-[60px_1.2fr_1.3fr_130px_1fr_70px] gap-3 border-b border-border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Heure</span><span>Nom</span><span>Entreprise</span><span>Potentiel</span><span>Action</span><span>Par</span>
            </div>
            {DESKTOP_ROWS.map((r, i) => (
              <div
                key={r.n}
                data-row=""
                className={cn('grid grid-cols-[60px_1.2fr_1.3fr_130px_1fr_70px] items-center gap-3 border-b border-border px-4 py-3 text-[14px] last:border-b-0 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none', shown ? 'translate-y-0 opacity-100' : 'translate-y-[6px] opacity-0')}
                style={{ transitionDelay: shown && !reduced ? `${i * 60}ms` : '0ms' }}
              >
                <span className="text-muted-foreground">{r.t}</span>
                <span className="truncate font-medium">{r.n}</span>
                <span className="truncate text-muted-foreground">{r.c}</span>
                <span><PotentialBadge value={r.p} /></span>
                <span className="truncate">{r.a}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-booth-sky text-[12px] font-semibold text-primary-deep">{r.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
