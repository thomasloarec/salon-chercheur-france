import { Mic, QrCode, Camera, Plus, Check, Phone, FileText, Receipt, CalendarDays } from 'lucide-react';
import GoalRing from '@/features/booth/home/GoalRing';
import PotentialBadge from '@/features/booth/ui/PotentialBadge';
import { useInView } from '@/components/ui/reveal';
import { cn } from '@/lib/utils';

function Frame({ children, small, label }: { children: React.ReactNode; small?: boolean; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('mx-auto rounded-[2.5rem] bg-booth-navy p-2.5 shadow-xl', small ? 'w-[230px]' : 'w-full max-w-[320px]')}
    >
      <div className="overflow-hidden rounded-[2rem] bg-booth-canvas" aria-hidden="true">
        <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-booth-navy/80" />
        {children}
      </div>
    </div>
  );
}

const MEETINGS = [
  { name: 'Marie D. · Schneider Electric', p: 'hot' as const },
  { name: 'Paul R. · Legrand', p: 'good' as const },
  { name: 'Inès K. · Veolia', p: 'explore' as const },
];

/** Accueil du mode salon dessiné en code, données d'exemple. */
export default function PhoneMockup() {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref}>
      <Frame label="Aperçu de l'accueil du salon dans Lotexpo Leads">
        <div className="space-y-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Jour 2 sur 3 · Stand B42</p>
            <p className="text-lg font-semibold">SEPEM Grenoble</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-booth-navy p-3">
            {inView ? <GoalRing value={9} max={12} reached={false} /> : <div className="h-[84px] w-[84px] shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-background">Objectif du jour</p>
              <p className="text-xs text-booth-on-navy">Encore 3 rencontres pour l'équipe.</p>
            </div>
          </div>
          <div className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> Nouvelle rencontre
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{ i: Mic, l: 'Dicter' }, { i: QrCode, l: 'Badge QR' }, { i: Camera, l: 'Carte' }].map(({ i: I, l }) => (
              <div key={l} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-2 text-xs">
                <I className="h-4 w-4 text-primary" /> {l}
              </div>
            ))}
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {MEETINGS.map((m) => (
              <div key={m.name} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-xs font-medium">{m.name}</span>
                <PotentialBadge value={m.p} className="shrink-0 text-[11px]" />
              </div>
            ))}
          </div>
        </div>
      </Frame>
    </div>
  );
}

export function ActionPhone() {
  const items = [
    { i: Phone, l: 'Rappeler' },
    { i: FileText, l: 'Envoyer une doc' },
    { i: Receipt, l: 'Devis', on: true },
    { i: CalendarDays, l: 'Rendez-vous' },
  ];
  return (
    <Frame small label="Aperçu de l'étape Prochaine action">
      <div className="space-y-2 p-4">
        <p className="text-sm font-semibold">Prochaine action</p>
        {items.map(({ i: I, l, on }) => (
          <div key={l} className={cn('flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs', on ? 'border-primary bg-booth-good-bg' : 'border-border')}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-booth-sky"><I className="h-3.5 w-3.5 text-primary" /></span>
            {l}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function SavedPhone() {
  return (
    <Frame small label="Aperçu de l'écran Rencontre enregistrée">
      <div className="flex h-[218px] flex-col items-center justify-center gap-3 p-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bright">
          <Check className="h-8 w-8 text-background" />
        </span>
        <p className="text-sm font-semibold">Rencontre enregistrée</p>
      </div>
    </Frame>
  );
}
