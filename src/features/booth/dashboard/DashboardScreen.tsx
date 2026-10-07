import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

function Tile({ value, label, sub, subWarn, onClick }: { value: string; label: string; sub?: string; subWarn?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[96px] flex-col items-start justify-center rounded-xl border border-border bg-card p-4 text-left active:bg-muted"
    >
      <span className="text-3xl font-bold leading-none tabular-nums">{value}</span>
      <span className="mt-1 text-sm text-muted-foreground">{label}</span>
      {sub && <span className={`mt-0.5 text-xs font-medium ${subWarn ? 'text-warning-foreground' : 'text-muted-foreground'}`}>{sub}</span>}
    </button>
  );
}

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-muted-foreground">{r.label}</span>
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
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
}: {
  cache: BoothCache;
  me: string;
  pendingCount: number;
  lastSyncAt: string | null;
  onBack: () => void;
  onOpenList: (f: ListFilter) => void;
  onDebrief: () => void;
  onActions: () => void;
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
      <h2 className="text-lg font-semibold">Tableau de bord</h2>
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
        <DayChips days={days} value={day} onChange={setDay} />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {scopes.map(({ s, label }) => (
            <Button
              key={scopeKey(s)}
              size="sm"
              variant={scopeKey(scope) === scopeKey(s) ? 'default' : 'outline'}
              className="min-h-[44px] shrink-0 rounded-full"
              onClick={() => setScope(s)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile value={String(m.meetings)} label="Rencontres" onClick={() => onOpenList({ ids: m.ids.all, label: 'Rencontres' })} />
          <Tile value={String(m.people)} label="Personnes rencontrées" onClick={() => onOpenList({ ids: m.ids.all, label: 'Personnes rencontrées' })} />
          <Tile value={String(m.hot)} label="Prospects chauds" onClick={() => onOpenList({ ids: m.ids.hot, label: 'Prospects chauds' })} />
          <Tile
            value={String(m.projects)}
            label="Projets concrets"
            sub={[m.projectsAmount > 0 ? formatEuros(m.projectsAmount, cur) : '', m.projectsWithoutAmount > 0 ? `dont ${m.projectsWithoutAmount} sans montant` : ''].filter(Boolean).join(' · ') || undefined}
            onClick={() => onOpenList({ ids: m.ids.withProject, label: 'Projets concrets' })}
          />
          <Tile
            value={String(m.actionsTodo)}
            label="Actions à faire"
            sub={m.actionsOverdue > 0 ? `dont ${m.actionsOverdue} en retard` : undefined}
            subWarn
            onClick={onActions}
          />
          <Tile value={String(m.customers)} label="Clients rencontrés" onClick={() => onOpenList({ ids: m.ids.customers, label: 'Clients rencontrés' })} />
        </div>

        <p className="text-xs text-muted-foreground">
          Calculé sur ce téléphone, mis à jour à {timeInTz(syncRef, tz)}.
          {pendingCount > 0 ? ` Inclut ${pendingCount} saisie${pendingCount > 1 ? 's' : ''} pas encore envoyée${pendingCount > 1 ? 's' : ''}.` : ''}
        </p>

        <Button size="lg" variant="secondary" className="min-h-[56px] w-full text-base" onClick={onDebrief}>
          <ClipboardList className="mr-2 h-5 w-5" /> Débrief du jour
        </Button>

        <section className="rounded-xl border border-border p-4">
          <h3 className="mb-3 font-semibold">Potentiel des prospects</h3>
          <Bars
            rows={[
              { label: 'Chaud', count: m.potential.hot },
              { label: 'Bon', count: m.potential.good },
              { label: 'À explorer', count: m.potential.explore },
              { label: 'Aucun', count: m.potential.none },
            ]}
          />
        </section>

        <section className="rounded-xl border border-border p-4">
          <h3 className="mb-3 font-semibold">{m.seriesMode === 'day' ? 'Rencontres par jour' : 'Rencontres par heure'}</h3>
          {m.series.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune rencontre.</p>
          ) : (
            <Bars rows={m.series.map((s) => ({ label: m.seriesMode === 'day' ? shortDate(s.key) : s.label, count: s.count }))} />
          )}
        </section>

        {isManager && (
          <>
            <section className="rounded-xl border border-border p-4">
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

            <section className="rounded-xl border border-border p-4">
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
  );
}
