import type { ReactNode } from 'react';
import { Camera, ChevronRight, Mic, Pencil, QrCode, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import AppButton from '../ui/ChunkyButton';
import type { ResumeChoice, StartMode } from './goal';

/** Carte « Rencontre en cours » : une ligne tronquée, Reprendre et Effacer. */
export function DraftCard({ label, onResume, onClear }: { label: string; onResume: () => void; onClear: () => void }) {
  return (
    <div data-draft-card="" className="flex items-center gap-3 rounded-xl border border-booth-draft-line bg-background p-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-booth-good-bg text-primary">
        <Pencil className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug">Rencontre en cours</span>
        {label && <span className="block truncate text-sm text-muted-foreground">{label}</span>}
      </span>
      <button type="button" onClick={onResume} className="min-h-[40px] shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
        Reprendre
      </button>
      <button type="button" onClick={onClear} aria-label="Effacer le brouillon" className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

const TILE: Record<StartMode, { label: string; icon: typeof Mic }> = {
  dictate: { label: 'Dicter', icon: Mic },
  badge: { label: 'Badge QR', icon: QrCode },
  card: { label: 'Carte', icon: Camera },
};

export function QuickTiles({ modes, online, onPick }: { modes: StartMode[]; online: boolean; onPick: (m: StartMode) => void }) {
  if (modes.length === 0) return null;
  const voiceOff = modes.includes('dictate') && !online;
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}>
        {modes.map((m) => {
          const { label, icon: Icon } = TILE[m];
          const disabled = m === 'dictate' && !online;
          return (
            <button
              key={m}
              type="button"
              data-tile={m}
              disabled={disabled}
              onClick={() => onPick(m)}
              className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-1 text-[13px] font-medium transition-transform duration-[80ms] enabled:active:scale-[0.98] disabled:opacity-50"
            >
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      {voiceOff && <p className="mt-1 text-xs text-muted-foreground">Dictée disponible avec du réseau</p>}
    </div>
  );
}

export interface MenuRow {
  key: string;
  label: string;
  count?: number;
  badge?: boolean;
  onClick: () => void;
}

export function HomeMenu({ rows }: { rows: MenuRow[] }) {
  return (
    <nav className="overflow-hidden rounded-xl border border-border bg-background">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.key}>
            <button type="button" onClick={r.onClick} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-base font-medium hover:bg-muted">
              <span className="min-w-0 flex-1 break-words">{r.label}</span>
              {typeof r.count === 'number' &&
                (r.badge ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">{r.count}</span>
                ) : (
                  <span className="text-sm tabular-nums text-muted-foreground">{r.count}</span>
                ))}
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Contenu de la feuille de reprise, séparé pour pouvoir le tester. */
export function ResumeChoices({ name, onChoice }: { name: string; onChoice: (c: ResumeChoice) => void }) {
  return (
    <div className="space-y-2" data-resume="">
      {name && <p className="truncate text-base text-muted-foreground">{name}</p>}
      <AppButton data-choice-resume="" onClick={() => onChoice('resume')}>Reprendre la rencontre</AppButton>
      <AppButton data-choice-new="" variant="secondary" onClick={() => onChoice('new')}>Commencer une nouvelle rencontre</AppButton>
      <button type="button" data-choice-cancel="" onClick={() => onChoice('cancel')} className="mx-auto block min-h-[44px] text-sm font-medium text-primary underline underline-offset-2">
        Annuler
      </button>
    </div>
  );
}

export function ResumeSheet({ open, name, onChoice }: { open: boolean; name: string; onChoice: (c: ResumeChoice) => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onChoice('cancel')}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="mb-3 text-left">
          <SheetTitle className="font-semibold">Une rencontre est en cours</SheetTitle>
          <SheetDescription className="sr-only">Reprendre la rencontre ou en commencer une nouvelle.</SheetDescription>
        </SheetHeader>
        <ResumeChoices name={name} onChoice={onChoice} />
      </SheetContent>
    </Sheet>
  );
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-background p-4 ${className}`}>{children}</section>;
}
