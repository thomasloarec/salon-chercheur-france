import { useMemo, useState } from 'react';
import Chip from '../ui/Chip';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import CountUp from '../ui/CountUp';
import PotentialBadge from '../ui/PotentialBadge';
import AppButton from '../ui/ChunkyButton';
import { useCalmMotion } from '../ui/motion';
import type { Interaction } from '@/lib/booth/types';

type Potential = NonNullable<Interaction['potential']>;
import type { BoothCache } from '../sync/cache';
import { shortDate, timeInTz } from '../salon/display';
import { computeMetrics, formatEuros, type Scope } from './metrics';
import DayChips, { useSalonDays } from './DayChips';

export interface ListFilter {
  ids: string[];
  label: string;
}

export const memberName = (cache: BoothCache, userId: string) => {
  const t = cache.team.find((m) => m.user_id === userId);
  return t?.name || t?.email || 'Membre';
};

function Tile({ value, label, sub, subWarn, onClick }: { value: number; label: string; sub?: string; subWarn?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[96px] flex-col md:min-h-0 items-start justify-center rounded-xl border border-border bg-background p-4 text-left active:bg-muted"
    >
      <span className="text-[28px] font-semibold leading-none"><CountUp from={0} to={value} /></span>
      <span className="mt-1 text-sm font-medium text-muted-foreground">{label}</span>
      {sub && <span className={`mt-0.5 text-xs font-medium ${subWarn ? 'text-warning-foreground' : 'text-muted-foreground'}`}>{sub}</span>}
    </button>
  );
}

const POT_BAR: Record<string, string> = { hot: 'bg-flame', good: 'bg-primary', explore: 'bg-booth-explore-fg', none: 'bg-muted-foreground' };

function Bars({ rows }: { rows: { label: string; count: number; potential?: Potential }[] }) {
  const calm = useCalmMotion();
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r, idx) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0">{r.potential ? <PotentialBadge value={r.potential} /> : <span className="text-muted-foreground">{r.label}</span>}</span>
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-booth-pill md:max-w-[480px]">
            <motion.span
              className={`block h-full rounded-full ${r.potential ? POT_BAR[r.potential] : 'bg-primary'}`}
              initial={calm ? false : { width: 0 }}
              animate={{ width: `${(r.count / max) * 100}%` }}
              transition={calm ? { duration: 0 } : { duration: 0.5, delay: idx * 0.04, ease: 'easeOut' }}
            />
          </span>
          <span className="w-8 text-right tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardScreen({
  cache,
  me,
  pendingCount,
  lastSyncAt,
  onBack,
  onOpenList,
  onDebrief,
  onActions,
  onOutcome,
}: {
  cache: BoothCache;
  me: string;
  pendingCount: number;
  lastSyncAt: string | null;
  onBack: () => void;
  onOpenList: (f: ListFilter) => void;
  onDebrief: () => void;
  onActions: () => void;
  onOutcome?: () => void;
}) {
  const [day, setDay] = useState<string>('all');
  const [scope, setScope] = useState<Scope>('team');
  const days = useSalonDays(cache);
  const isManager = cache.role === 'manager';
  const tz = cache.workspace.timezone || 'Europe/Paris';
  const cur = cache.workspace.currency || 'EUR';

  const m = useMemo(() => computeMetrics(cache, { day, scope, me }), [cache, day, scope, me]);

  const header = (
    <div className="flex items-center gap-2 px-2 py-2">
      <Button variant="ghost" className="min-h-[44px] px-2" onClick={onBack}>
        <ArrowLeft className="mr-1 h-5 w-5" /> Accueil
      </Button>
      <h2 className="text-lg font-semibold tracking-[-0.02em]">Tableau de bord</h2>
    </div>
  );

  if (!cache.full_features) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <p className="p-6 text-center text-base">Le tableau de bord est inclus dans la bêta, le Pass Salon et l'Annuel.</p>
      </div>
    );
  }

  const scopeKey = (s: Scope) => (typeof s === 'string' ? s : s.userId);
  const scopes: { s: Scope; label: string }[] = [
    { s: 'team', label: 'Équipe' },
    { s: 'mine', label: 'Les miennes' },
    ...(isManager ? cache.team.filter((t) => t.user_id !== me).map((t) => ({ s: { userId: t.user_id } as Scope, label: memberName(cache, t.user_id) })) : []),
  ];
  const syncRef = lastSyncAt ?? cache.saved_at;

  return (
    <div className="flex flex-1 flex-col">
      {header}
      <div className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="space-y-4 md:flex md:flex-wrap md:items-start md:gap-2 md:space-y-0">
        <DayChips days={days} value={day} onChange={setDay} />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {scopes.map(({ s, label }) => (
            <Chip key={scopeKey(s)}
              selected={scopeKey(scope) === scopeKey(s)} onClick={() => setScope(s)}>
              {label}
            </Chip>
          ))}
        </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Tile value={m.meetings} label="Rencontres" onClick={() => onOpenList({ ids: m.ids.all, label: 'Rencontres' })} />
          <Tile value={m.people} label="Personnes rencontrées" onClick={() => onOpenList({ ids: m.ids.all, label: 'Personnes rencontrées' })} />
          <Tile value={m.hot} label="Prospects chauds" onClick={() => onOpenList({ ids: m.ids.hot, label: 'Prospects chauds' })} />
          <Tile
            value={m.projects}
            label="Projets concrets"
            sub={[m.projectsAmount > 0 ? formatEuros(m.projectsAmount, cur) : '', m.projectsWithoutAmount > 0 ? `dont ${m.projectsWithoutAmount} sans montant` : ''].filter(Boolean).join(' · ') || undefined}
            onClick={() => onOpenList({ ids: m.ids.withProject, label: 'Projets concrets' })}
          />
          <Tile
            value={m.actionsTodo}
            label="Actions à faire"
            sub={m.actionsOverdue > 0 ? `dont ${m.actionsOverdue} en retard` : undefined}
            subWarn
            onClick={onActions}
          />
          <Tile value={m.customers} label="Clients rencontrés" onClick={() => onOpenList({ ids: m.ids.customers, label: 'Clients rencontrés' })} />
        </div>

        <p className="text-xs text-muted-foreground">
          Calculé sur cet appareil, mis à jour à {timeInTz(syncRef, tz)}.
          {pendingCount > 0 ? ` Inclut ${pendingCount} saisie${pendingCount > 1 ? 's' : ''} pas encore envoyée${pendingCount > 1 ? 's' : ''}.` : ''}
        </p>

        <div className="space-y-4 md:flex md:flex-row md:flex-wrap md:gap-3 md:space-y-0">
        <AppButton className="md:w-auto md:min-w-[200px]" onClick={onDebrief}>
          <ClipboardList className="h-5 w-5" /> Débrief du jour
        </AppButton>
        {isManager && onOutcome && (
          <AppButton variant="secondary" className="md:w-auto md:min-w-[200px]" onClick={onOutcome}>
            Bilan du salon
          </AppButton>
        )}
        </div>

        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">

        <section className="rounded-xl border border-border bg-background p-4">
          <h3 className="mb-3 font-semibold">Potentiel des prospects</h3>
          <Bars
            rows={[
              { label: 'Chaud', count: m.potential.hot, potential: 'hot' },
              { label: 'Bon', count: m.potential.good, potential: 'good' },
              { label: 'À explorer', count: m.potential.explore, potential: 'explore' },
              { label: 'Aucun', count: m.potential.none, potential: 'none' },
            ]}
          />
        </section>

        <section className="rounded-xl border border-border bg-background p-4">
          <h3 className="mb-3 font-semibold">{m.seriesMode === 'day' ? 'Rencontres par jour' : 'Rencontres par heure'}</h3>
          {m.series.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune rencontre.</p>
          ) : (
            <Bars rows={m.series.map((s) => ({ label: m.seriesMode === 'day' ? shortDate(s.key) : s.label, count: s.count }))} />
          )}
        </section>

        {isManager && (
          <>
            <section className="rounded-xl border border-border bg-background p-4">
              <h3 className="mb-3 font-semibold">Par membre</h3>
              {m.byMember.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune rencontre.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left font-medium">Membre</th>
                      <th className="py-1 text-right font-medium">Renc.</th>
                      <th className="py-1 text-right font-medium">Chauds</th>
                      <th className="py-1 text-right font-medium">Projets</th>
                      <th className="py-1 text-right font-medium">Retard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.byMember.map((r) => (
                      <tr key={r.userId} className="border-t border-border">
                        <td className="py-2 pr-2">{memberName(cache, r.userId)}</td>
                        <td className="py-2 text-right tabular-nums">{r.meetings}</td>
                        <td className="py-2 text-right tabular-nums">{r.hot}</td>
                        <td className="py-2 text-right tabular-nums">{r.projects}</td>
                        <td className={`py-2 text-right tabular-nums ${r.overdue > 0 ? 'text-warning-foreground font-medium' : ''}`}>{r.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="rounded-xl border border-border bg-background p-4">
              <h3 className="mb-3 font-semibold">Rentabilité</h3>
              {m.totalCost === null ? (
                <p className="text-sm text-muted-foreground">Renseignez le coût du salon dans l'espace exposant pour voir la rentabilité.</p>
              ) : (
                <dl className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Coût du salon</dt><dd className="font-semibold">{formatEuros(m.totalCost, cur)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Coût par rencontre</dt><dd className="font-semibold">{m.costPerMeeting !== null ? formatEuros(m.costPerMeeting, cur) : 'Pas encore de rencontre'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Coût par projet concret</dt><dd className="font-semibold">{m.costPerProject !== null ? formatEuros(m.costPerProject, cur) : 'Pas encore de projet'}</dd></div>
                </dl>
              )}
            </section>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
