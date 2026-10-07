import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { boothErrorMessage, workspacesSummary, type BoothWorkspaceSummaryItem } from '@/lib/booth/rpc';

type Key = 'date' | 'meetings' | 'hot' | 'projects' | 'weighted' | 'won' | 'cost' | 'cpm' | 'roi';
type It = BoothWorkspaceSummaryItem;
const cost = (w: It) => (typeof w.total_cost === 'number' && w.total_cost > 0 ? w.total_cost : null);
const cpm = (w: It) => (cost(w) !== null && w.meetings > 0 ? cost(w)! / w.meetings : null);
const roi = (w: It) => (cost(w) !== null && typeof w.won_amount === 'number' ? w.won_amount / cost(w)! : null);
const VAL: Record<Key, (w: It) => number | string | null> = {
  date: (w) => w.date_debut,
  meetings: (w) => w.meetings,
  hot: (w) => w.hot,
  projects: (w) => w.projects,
  weighted: (w) => w.weighted_amount,
  won: (w) => w.won_amount,
  cost,
  cpm,
  roi,
};
const eur = (n: number | null, c?: string | null) =>
  n === null || n === undefined ? '' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c || 'EUR', maximumFractionDigits: 0 }).format(n);
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function BoothCompareSalons({ exhibitorId }: { exhibitorId: string }) {
  const [sort, setSort] = useState<{ k: Key; desc: boolean }>({ k: 'date', desc: true });
  const q = useQuery({ queryKey: ['booth-ws-summary', exhibitorId], queryFn: () => workspacesSummary(exhibitorId), retry: false });
  const items = useMemo(() => {
    const list = [...(q.data?.items ?? [])];
    const f = VAL[sort.k];
    return list.sort((a, b) => {
      const x = f(a), y = f(b);
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const r = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -r : r;
    });
  }, [q.data, sort]);

  const cols: { k: Key; label: string }[] = [
    { k: 'date', label: 'Salon' },
    { k: 'meetings', label: 'Rencontres' },
    { k: 'hot', label: 'Prospects chauds' },
    { k: 'projects', label: 'Projets' },
    { k: 'weighted', label: 'Pipeline pondéré' },
    { k: 'won', label: 'Gagné' },
    { k: 'cost', label: 'Coût' },
    { k: 'cpm', label: 'Coût par rencontre' },
    { k: 'roi', label: 'Retour sur investissement' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Comparer mes salons</CardTitle></CardHeader>
      <CardContent>
        {q.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-muted-foreground">
            {String((q.error as Error)?.message ?? '').includes('BOOTH_PLAN_REQUIRED')
              ? "La comparaison entre salons est incluse dans la bêta, le Pass Salon et l'Annuel."
              : boothErrorMessage(q.error)}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  {cols.map((c) => (
                    <th key={c.k} className={c.k === 'date' ? 'text-left' : 'text-right'}>
                      <button
                        type="button"
                        className="min-h-[44px] px-2 font-medium hover:text-foreground"
                        onClick={() => setSort((s) => ({ k: c.k, desc: s.k === c.k ? !s.desc : true }))}
                      >
                        {c.label}{sort.k === c.k ? (sort.desc ? ' ▼' : ' ▲') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((w) => {
                  const r = roi(w);
                  return (
                    <tr key={w.workspace_id} className="border-t border-border">
                      <td className="px-2 py-2">
                        <p className="font-medium">{w.nom_event}</p>
                        <p className="text-xs text-muted-foreground">{[w.ville, [d(w.date_debut), d(w.date_fin)].filter(Boolean).join(' au ')].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-2 text-right tabular-nums">{w.meetings}</td>
                      <td className="px-2 text-right tabular-nums">{w.hot}</td>
                      <td className="px-2 text-right tabular-nums">{w.projects}</td>
                      <td className="px-2 text-right tabular-nums">{eur(w.weighted_amount, w.currency)}</td>
                      <td className="px-2 text-right tabular-nums">{eur(w.won_amount, w.currency)}</td>
                      <td className="px-2 text-right tabular-nums">{eur(cost(w), w.currency)}</td>
                      <td className="px-2 text-right tabular-nums">{eur(cpm(w), w.currency)}</td>
                      <td className="px-2 text-right tabular-nums">{r === null ? '' : `× ${r.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
