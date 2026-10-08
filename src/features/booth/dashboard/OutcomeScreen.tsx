import { useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { boothErrorMessage } from '@/lib/booth/rpc';
import type { Opportunity } from '@/lib/booth/types';
import type { BoothCache } from '../sync/cache';
import { enqueue } from '../sync/engine';
import { fullName } from '../salon/labels';
import { computeMetrics, computeOutcome, formatEuros } from './metrics';
import { runExport } from './exportWorkspace';

const STATUS: { v: Opportunity['status']; label: string }[] = [
  { v: 'open', label: 'En cours' },
  { v: 'won', label: 'Gagné' },
  { v: 'lost', label: 'Perdu' },
  { v: 'abandoned', label: 'Abandonné' },
];
const PROBAS = [10, 25, 50, 75, 90] as const;
const PROBA_LABEL: Record<(typeof PROBAS)[number], string> = {
  10: 'Faible',
  25: 'Possible',
  50: 'Une chance sur deux',
  75: 'Probable',
  90: 'Quasi sûr',
};
const pct = (v: number | null) => (v === null ? 'Non calculable' : `${Math.round(v * 100)} %`);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function AmountInput({
  value,
  onCommit,
  label,
  placeholder = 'Montant en euros',
}: {
  value: number | null;
  onCommit: (n: number | null) => void;
  label: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(value === null ? '' : String(value));
  const commit = () => {
    const t = v.replace(/\s/g, '').replace(',', '.');
    const n = t === '' ? null : Number(t);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return;
    if (n !== value) onCommit(n);
  };
  return (
    <label className="flex flex-col gap-1 text-sm md:flex-row md:items-center md:gap-3">
      <span className="text-muted-foreground md:w-36 md:shrink-0">{label}</span>
      <Input inputMode="decimal" className="min-h-[44px] md:max-w-[220px]" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} />
    </label>
  );
}

export default function OutcomeScreen({
  cache,
  me,
  online,
  onBack,
}: {
  cache: BoothCache;
  me: string;
  online: boolean;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null);
  const cur = cache.workspace.currency || 'EUR';
  const o = useMemo(() => computeOutcome(cache, 'team', me), [cache, me]);
  const m = useMemo(() => computeMetrics(cache, { day: 'all', scope: 'team', me }), [cache, me]);

  const projects = useMemo(() => {
    const list = cache.opportunities.filter(
      (p) => (!p.workspace_id || p.workspace_id === cache.workspaceId) && p.status !== 'abandoned',
    );
    const incomplete = (p: Opportunity) =>
      (p.status === 'open' && (p.amount === null || p.probability === null)) || (p.status === 'won' && p.won_amount === null);
    return [...list].sort((a, b) => Number(incomplete(b)) - Number(incomplete(a)));
  }, [cache]);

  const header = (
    <div className="flex items-center gap-2 px-2 py-2 print:hidden">
      <Button variant="ghost" className="min-h-[44px] px-2" onClick={onBack}>
        <ArrowLeft className="mr-1 h-5 w-5" /> Retour
      </Button>
      <h2 className="text-lg font-semibold">Bilan du salon</h2>
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

  const update = (id: string, data: Record<string, unknown>) => enqueue(me, cache.exhibitorId, 'opportunity', id, data);
  const contactOf = (p: Opportunity) => cache.contacts.find((c) => c.id === p.contact_id);

  const doExport = async (kind: 'xlsx' | 'csv') => {
    setBusy(kind);
    try {
      const data = await runExport(cache.workspaceId, cache.workspace.nom_event, kind);
      const n = data.rows?.length ?? 0;
      const p = data.projects?.length ?? 0;
      const known = cache.interactions.filter((i) => !i.workspace_id || i.workspace_id === cache.workspaceId).length;
      toast({
        description: `${n} rencontre${n > 1 ? 's' : ''} et ${p} projet${p > 1 ? 's' : ''} exporté${n + p > 1 ? 's' : ''}.${n !== known ? ' Attention : certaines saisies ne sont pas encore envoyées.' : ''}`,
      });
    } catch (e) {
      toast({ description: boothErrorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <style>{`@media print { body * { visibility: hidden !important; } .outcome-print, .outcome-print * { visibility: visible !important; } .outcome-print { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      {header}
      <div className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="outcome-print space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0 print:!block print:space-y-4">
          <h2 className="hidden text-xl font-bold print:block">Bilan · {cache.workspace.nom_event}</h2>
          <section className="rounded-xl border border-border p-4 lg:sticky lg:top-20 print:static">
            <h3 className="mb-2 font-semibold">Résultats</h3>
            <dl className="text-sm">
              <Row label="Pipeline" value={formatEuros(o.pipeline, cur)} />
              <Row label="Pipeline pondéré" value={formatEuros(o.weighted, cur)} />
              <p className="-mt-1 pb-2 text-xs text-muted-foreground">Montant estimé × chance de signer, projets en cours seulement.</p>
              <Row label="Gagnés" value={`${o.won} · ${formatEuros(o.wonAmount, cur)}`} />
              <Row label="Perdus" value={String(o.lost)} />
              <Row label="Taux de transformation" value={pct(o.conversion)} />
              <Row label="Retour sur investissement" value={o.roi === null ? 'Coût non renseigné' : `× ${o.roi.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`} />
              <Row label="Coût par rencontre" value={m.costPerMeeting === null ? 'Non calculable' : formatEuros(m.costPerMeeting, cur)} />
              <Row label="Coût par projet concret" value={m.costPerProject === null ? 'Non calculable' : formatEuros(m.costPerProject, cur)} />
              <Row label="Actions réalisées" value={pct(o.actionsRate)} />
            </dl>
          </section>

          <section className="rounded-xl border border-border p-4">
            <h3 className="mb-2 font-semibold">Projets à compléter</h3>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun projet pour ce salon.</p>
            ) : (
              <ul className="space-y-4">
                {projects.map((p) => {
                  const c = contactOf(p);
                  const who = [c?.company_name, fullName(c)].filter(Boolean).join(' · ') || 'Contact';
                  const wonMissing = p.status === 'won' && p.won_amount === null;
                  const openMissing = p.status === 'open' && (p.amount === null || p.probability === null);
                  const printLine =
                    p.status === 'won'
                      ? `Gagné${p.won_amount !== null ? ` · ${formatEuros(p.won_amount, cur)} signés` : ''}`
                      : p.status === 'open'
                        ? `En cours${p.amount !== null ? ` · ${formatEuros(p.amount, cur)}` : ''}${p.probability !== null ? ` · chance de signer ${p.probability} %` : ''}`
                        : (STATUS.find((s) => s.v === p.status)?.label ?? '');
                  return (
                    <li key={p.id} className="space-y-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
                      <div>
                        <p className="font-medium">{who}</p>
                        {p.title && <p className="text-sm text-muted-foreground">{p.title}</p>}
                        {wonMissing && <p className="text-sm font-medium text-destructive print:hidden">Montant signé à renseigner</p>}
                        {openMissing && <p className="text-sm font-medium text-destructive print:hidden">Montant ou chance de signer à renseigner</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 print:hidden">
                        {STATUS.map((s) => (
                          <Button
                            key={s.v}
                            size="sm"
                            variant={p.status === s.v ? 'default' : 'outline'}
                            className="min-h-[44px] rounded-full"
                            onClick={() => {
                              if (p.status === s.v) return;
                              const data: Record<string, unknown> = { status: s.v };
                              if (s.v === 'won') {
                                const w = p.won_amount ?? p.amount;
                                if (w !== null) data.won_amount = w;
                              }
                              void update(p.id, data);
                            }}
                          >
                            {s.label}
                          </Button>
                        ))}
                      </div>
                      <p className="hidden text-sm print:block">{printLine}</p>
                      <div className="space-y-3 print:hidden">
                        {p.status === 'open' && (
                          <>
                            <AmountInput key={`a${p.id}${p.amount}`} label="Montant estimé" value={p.amount} onCommit={(n) => void update(p.id, { amount: n })} />
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">Chance de signer</p>
                              <div className="flex flex-wrap gap-2 md:flex-nowrap md:overflow-x-auto">
                                {PROBAS.map((v) => (
                                  <Button
                                    key={v}
                                    size="sm"
                                    variant={p.probability === v ? 'default' : 'outline'}
                                    className="h-auto min-h-[52px] min-w-[72px] flex-col gap-0 rounded-xl px-3 py-1.5"
                                    onClick={() => void update(p.id, { probability: p.probability === v ? null : v })}
                                  >
                                    <span className="font-semibold">{v} %</span>
                                    <span className="text-xs font-normal">{PROBA_LABEL[v]}</span>
                                  </Button>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {p.amount !== null && p.probability !== null
                                  ? `Ce projet compte pour ${formatEuros((p.amount * p.probability) / 100, cur)} dans le pipeline pondéré (${formatEuros(p.amount, cur)} × ${p.probability} %).`
                                  : 'Indiquez le montant estimé et la chance de signer pour calculer le pipeline pondéré.'}
                              </p>
                            </div>
                          </>
                        )}
                        {p.status === 'won' && (
                          <div className="space-y-2">
                            <AmountInput
                              key={`w${p.id}${p.won_amount}`}
                              label="Montant signé"
                              placeholder="Montant signé en euros"
                              value={p.won_amount}
                              onCommit={(n) => void update(p.id, { won_amount: n })}
                            />
                            {p.won_amount === null && p.amount !== null && (
                              <Button
                                variant="outline"
                                className="min-h-[44px] w-full md:w-auto"
                                onClick={() => void update(p.id, { won_amount: p.amount })}
                              >
                                Reprendre le montant estimé ({formatEuros(p.amount, cur)})
                              </Button>
                            )}
                          </div>
                        )}
                        {(p.status === 'lost' || p.status === 'abandoned') && p.amount !== null && (
                          <p className="text-sm text-muted-foreground">Montant estimé : {formatEuros(p.amount, cur)}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="space-y-3 rounded-xl border border-border p-4 print:hidden lg:ml-[calc(50%+0.75rem)]">
          <h3 className="font-semibold">Exporter</h3>
          {!online && <p className="text-sm text-muted-foreground">L'export nécessite une connexion.</p>}
          <div className="space-y-3 md:flex md:flex-wrap md:gap-3 md:space-y-0">
          <Button size="lg" className="min-h-[52px] w-full md:w-auto md:min-w-[200px] md:min-h-[48px]" disabled={!online || busy !== null} onClick={() => void doExport('xlsx')}>
            {busy === 'xlsx' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />} Exporter en Excel
          </Button>
          <Button size="lg" variant="outline" className="min-h-[52px] w-full md:w-auto md:min-w-[200px] md:min-h-[48px]" disabled={!online || busy !== null} onClick={() => void doExport('csv')}>
            {busy === 'csv' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />} Exporter en CSV
          </Button>
          </div>
        </section>

        <Button size="lg" variant="secondary" className="min-h-[52px] w-full print:hidden md:w-auto md:min-w-[200px] md:min-h-[48px] lg:ml-[calc(50%+0.75rem)]" onClick={() => window.print()}>
          <Printer className="mr-2 h-5 w-5" /> Imprimer le bilan
        </Button>
      </div>
    </div>
  );
}
